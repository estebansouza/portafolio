// Panel de administración: resumen, socios, check-in, cobranza y planes.
import { GYM } from "./config.js";
import * as db from "./data.js";
import {
  todayStr, daysBetween, fmtDate, membershipStatus, newExpiry, STATUS_LABEL, money, whatsappLink, reminderMessage,
} from "./membership.js";
import { downloadReceiptPdf } from "./receipt-pdf.js";
import { h, $, demoNotice } from "./ui.js";

const root = $("#root");
const logoutBtn = $("#logout");

const TABS = [["resumen", "Resumen"], ["socios", "Socios"], ["checkin", "Check-in"], ["cobranza", "Cobranza"], ["planes", "Planes"]];
const METHODS = ["efectivo", "transferencia", "tarjeta"];

const state = {
  tab: "resumen", plans: [], members: [],
  editing: null,      // socio en edición ({} = nuevo)
  editingPlan: null,  // plan en edición ({} = nuevo)
  paying: null,       // { member } cobrando
  receipt: null,      // { member, payment } recién cobrado
  flash: null,        // { text, ok }
};

const today = () => todayStr(new Date(), GYM.tz);
const dayStartIso = () => new Date(`${today()}T00:00:00${GYM.utcOffset}`).toISOString();
const planOf = (id) => state.plans.find((p) => p.id === id);
const statusOf = (m) => (m.active === false ? "inactivo" : membershipStatus(m.expires_on, today()));
const badge = (s) => h("span", { class: `badge ${s}` }, s === "inactivo" ? "Baja" : STATUS_LABEL[s]);
const field = (label, input, cls = "") => h("div", { class: cls }, h("label", {}, label), input);
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const matches = (m, q) => {
  const n = norm(q).trim();
  if (!n) return true;
  const digits = n.replace(/\D/g, "");
  return norm(m.name).includes(n) || (digits && String(m.document || "").replace(/\D/g, "").includes(digits));
};
const timeOf = (iso) => new Date(iso).toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit", timeZone: GYM.tz });
const dueText = (m) => {
  const d = daysBetween(today(), m.expires_on);
  return d < 0 ? `hace ${-d} día${d === -1 ? "" : "s"}` : d === 0 ? "hoy" : `en ${d} día${d === 1 ? "" : "s"}`;
};

// Ejecuta una acción; si falla muestra el error en vez de dejar la pantalla colgada.
async function run(fn, okText) {
  try {
    await fn();
    if (okText) state.flash = { text: okText, ok: true };
  } catch (e) {
    console.error(e);
    state.flash = { text: e.message || "Ocurrió un error", ok: false };
  }
  await draw();
}

async function reload() {
  [state.plans, state.members] = await Promise.all([db.listPlans({ includeInactive: true }), db.listMembers()]);
}

// ---------- Login ----------
function loginView(errorText = "") {
  logoutBtn.hidden = true;
  const email = h("input", { type: "text", autocomplete: "username", required: true, placeholder: db.isDemo ? "admin" : "email" });
  const pass = h("input", { type: "password", autocomplete: "current-password", required: true, placeholder: db.isDemo ? "admin" : "" });
  const msg = h("p", { class: "msg", role: "alert" }, errorText);
  const form = h("form", { class: "panel login", onsubmit: async (e) => {
    e.preventDefault();
    try {
      await db.login(email.value.trim(), pass.value);
      if (!(await db.isStaff())) { await db.logout(); throw new Error("Esta cuenta no tiene acceso al panel."); }
      await start();
    } catch (err) { msg.textContent = err.message || "No se pudo iniciar sesión"; }
  } },
    h("h2", {}, "Ingresar al panel"), field("Usuario", email), field("Contraseña", pass), msg,
    h("button", { class: "btn", type: "submit" }, "Entrar"));
  root.replaceChildren(...[demoNotice(db.isDemo), form].filter(Boolean));
}

// ---------- Cobro ----------
function payPanel() {
  const { member } = state.paying;
  const active = state.plans.filter((p) => p.active);
  const plan0 = planOf(member.plan_id)?.active ? planOf(member.plan_id) : active[0];
  if (!plan0) return h("div", { class: "panel" }, h("p", { class: "msg" }, "Primero creá un plan en la pestaña Planes."),
    h("button", { class: "btn ghost", onclick: () => { state.paying = null; draw(); } }, "Cerrar"));

  const planSel = h("select", {}, active.map((p) => h("option", { value: p.id, selected: p.id === plan0.id }, `${p.name} · ${money(p.price)}`)));
  const amount = h("input", { type: "number", min: "0", step: "1", value: plan0.price });
  const method = h("select", {}, METHODS.map((m) => h("option", { value: m }, m)));
  const preview = h("p", { class: "muted" });
  const msg = h("p", { class: "msg", role: "alert" });

  const calc = () => {
    const plan = planOf(planSel.value);
    const base = member.expires_on && member.expires_on >= today() ? member.expires_on : today();
    return { plan, coversFrom: base, expiresOn: newExpiry(member.expires_on, today(), plan.days) };
  };
  const refresh = () => { const c = calc(); preview.textContent = `Cubre del ${fmtDate(c.coversFrom)} al ${fmtDate(c.expiresOn)}.`; };
  planSel.addEventListener("change", () => { amount.value = planOf(planSel.value).price; refresh(); });
  refresh();

  const confirm = h("button", { class: "btn", type: "button", onclick: async () => {
    const value = Number(amount.value);
    if (!(value >= 0) || amount.value === "") { msg.textContent = "Ingresá un monto válido."; return; }
    confirm.disabled = true;
    const c = calc();
    await run(async () => {
      const payment = await db.registerPayment({ member, plan: c.plan, amount: value, method: method.value, paidOn: today(), coversFrom: c.coversFrom, expiresOn: c.expiresOn });
      state.receipt = { member, payment: { ...payment, plan_name: c.plan.name, amount: value, method: method.value, paid_on: today(), covers_from: c.coversFrom, expires_on: c.expiresOn } };
      state.paying = null;
      await reload();
    }, `Pago registrado para ${member.name}.`);
  } }, "Confirmar pago");

  return h("div", { class: "panel" },
    h("h2", {}, `Cobrar cuota · ${member.name}`),
    h("div", { class: "form-grid" }, field("Plan", planSel), field("Monto ($)", amount), field("Medio de pago", method)),
    preview, msg,
    h("div", { class: "actions" }, confirm, h("button", { class: "btn ghost", type: "button", onclick: () => { state.paying = null; draw(); } }, "Cancelar")));
}

function receiptPanel() {
  const { member, payment } = state.receipt;
  const err = h("p", { class: "msg", role: "alert" });
  return h("div", { class: "panel" },
    h("h2", {}, "Pago registrado"),
    h("p", { class: "muted" }, `${member.name} · ${payment.plan_name} · ${money(payment.amount)} · vence el ${fmtDate(payment.expires_on)}`),
    err,
    h("div", { class: "actions" },
      h("button", { class: "btn", type: "button", onclick: async (e) => {
        e.target.disabled = true;
        try { await downloadReceiptPdf(member, payment); } catch (ex) { console.error(ex); err.textContent = "No se pudo generar el PDF."; }
        e.target.disabled = false;
      } }, "Descargar comprobante PDF"),
      member.phone ? h("a", { class: "btn wa", target: "_blank", rel: "noopener",
        href: whatsappLink(member.phone, `Hola ${member.name.split(" ")[0]}, recibimos tu pago en ${GYM.name}. Tu cuota queda vigente hasta el ${fmtDate(payment.expires_on)}. ¡Gracias!`) }, "Avisar por WhatsApp") : null,
      h("button", { class: "btn ghost", type: "button", onclick: () => { state.receipt = null; draw(); } }, "Cerrar")));
}

// ---------- Resumen ----------
async function viewResumen() {
  const monthStart = today().slice(0, 8) + "01";
  const [payments, checkins] = await Promise.all([db.listPayments({ since: monthStart }), db.listCheckins(dayStartIso())]);
  const live = state.members.filter((m) => m.active !== false);
  const count = (s) => live.filter((m) => statusOf(m) === s).length;
  const income = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const nameOf = (id) => state.members.find((m) => m.id === id)?.name || "—";
  const stat = (label, value, cls = "") => h("div", { class: `stat ${cls}` }, h("b", {}, value), h("span", { class: "muted small" }, label));

  return h("div", {},
    h("div", { class: "stats" },
      stat("Socios activos", live.length), stat("Al día", count("al-dia"), "ok"),
      stat("Por vencer (7 días)", count("por-vencer"), "warn"), stat("Cuotas vencidas", count("vencida"), "danger"),
      stat("Ingresos del mes", money(income)), stat("Ingresos al gimnasio hoy", checkins.length)),
    h("div", { class: "panel" }, h("h2", {}, "Últimos pagos"),
      payments.length ? h("div", { class: "table-wrap" }, h("table", {},
        h("thead", {}, h("tr", {}, h("th", {}, "Socio"), h("th", { class: "hide-sm" }, "Plan"), h("th", {}, "Fecha"), h("th", { class: "right" }, "Monto"))),
        h("tbody", {}, payments.slice(0, 8).map((p) => h("tr", {},
          h("td", {}, nameOf(p.member_id)), h("td", { class: "hide-sm" }, p.plan_name), h("td", {}, fmtDate(p.paid_on)), h("td", { class: "right" }, money(p.amount))))))) :
        h("p", { class: "muted" }, "Todavía no hay pagos este mes.")));
}

// ---------- Socios ----------
function memberForm() {
  const m = state.editing;
  const name = h("input", { value: m.name, required: true, maxlength: "120" });
  const document = h("input", { value: m.document, maxlength: "30" });
  const phone = h("input", { value: m.phone, type: "tel", maxlength: "30", placeholder: "099 123 456" });
  const plan = h("select", {}, h("option", { value: "" }, "Sin plan"), state.plans.filter((p) => p.active || p.id === m.plan_id).map((p) => h("option", { value: p.id, selected: p.id === m.plan_id }, p.name)));
  const expires = h("input", { type: "date", value: m.expires_on || "" });
  const status = h("select", {}, h("option", { value: "1", selected: m.active !== false }, "Activo"), h("option", { value: "0", selected: m.active === false }, "Baja"));
  const notes = h("textarea", { rows: "2", maxlength: "500" }); notes.value = m.notes || "";
  const msg = h("p", { class: "msg", role: "alert" });

  return h("form", { class: "panel", onsubmit: (e) => {
    e.preventDefault();
    if (!name.value.trim()) { msg.textContent = "El nombre es obligatorio."; return; }
    const row = { name: name.value.trim(), document: document.value.trim(), phone: phone.value.trim(), plan_id: plan.value || null, expires_on: expires.value || null, active: status.value === "1", notes: notes.value.trim() };
    if (m.id) row.id = m.id;
    run(async () => { await db.saveMember(row); state.editing = null; await reload(); }, "Socio guardado.");
  } },
    h("h2", {}, m.id ? "Editar socio" : "Nuevo socio"),
    h("div", { class: "form-grid" },
      field("Nombre y apellido", name, "full"), field("Documento", document), field("Teléfono / WhatsApp", phone),
      field("Plan", plan), field("Vence el", expires), field("Estado", status), field("Notas", notes, "full")),
    msg,
    h("div", { class: "actions" }, h("button", { class: "btn", type: "submit" }, "Guardar"),
      h("button", { class: "btn ghost", type: "button", onclick: () => { state.editing = null; draw(); } }, "Cancelar")));
}

function viewSocios() {
  const search = h("input", { type: "search", placeholder: "Buscar por nombre o documento…", "aria-label": "Buscar socio" });
  const tbody = h("tbody");
  const paint = () => {
    const rows = state.members.filter((m) => matches(m, search.value));
    tbody.replaceChildren(...(rows.length ? rows.map((m) => h("tr", {},
      h("td", {}, h("strong", {}, m.name), h("div", { class: "muted small" }, m.document || "")),
      h("td", { class: "hide-sm" }, planOf(m.plan_id)?.name || "—"),
      h("td", {}, m.expires_on ? fmtDate(m.expires_on) : "—"),
      h("td", {}, badge(statusOf(m))),
      h("td", { class: "right" }, h("div", { class: "actions" },
        h("button", { class: "btn sm", onclick: () => { state.paying = { member: m }; state.receipt = null; draw(); } }, "Cobrar"),
        h("button", { class: "btn ghost sm", onclick: () => { state.editing = m; draw(); } }, "Editar"))))) :
      [h("tr", {}, h("td", { colspan: "5", class: "muted" }, "Sin resultados."))]));
  };
  search.addEventListener("input", paint);
  paint();

  return h("div", {},
    state.editing ? memberForm() : null,
    h("div", { class: "toolbar" }, h("div", { class: "grow" }, search),
      h("button", { class: "btn", onclick: () => { state.editing = { active: true }; draw(); } }, "Nuevo socio")),
    h("div", { class: "table-wrap" }, h("table", {},
      h("thead", {}, h("tr", {}, h("th", {}, "Socio"), h("th", { class: "hide-sm" }, "Plan"), h("th", {}, "Vence"), h("th", {}, "Estado"), h("th", {}))),
      tbody)));
}

// ---------- Check-in ----------
async function viewCheckin() {
  const todays = await db.listCheckins(dayStartIso());
  const nameOf = (id) => state.members.find((m) => m.id === id)?.name || "—";
  const search = h("input", { class: "checkin-search", type: "search", placeholder: "Nombre o documento del socio…", "aria-label": "Buscar socio para check-in", autofocus: true });
  const list = h("div");
  const paint = () => {
    const q = search.value;
    if (!q.trim()) { list.replaceChildren(h("p", { class: "muted" }, "Escribí el nombre o el documento para registrar un ingreso.")); return; }
    const found = state.members.filter((m) => m.active !== false && matches(m, q)).slice(0, 8);
    list.replaceChildren(...(found.length ? found.map((m) => {
      const s = statusOf(m);
      return h("div", { class: "result-row" },
        h("div", {}, h("strong", {}, m.name), " ", badge(s),
          h("div", { class: "muted small" }, m.expires_on ? (s === "vencida" ? `Venció ${dueText(m)} (${fmtDate(m.expires_on)})` : `Vence el ${fmtDate(m.expires_on)}`) : "Sin cuota registrada")),
        h("div", { class: "actions" },
          s === "vencida" || s === "sin-plan" ? h("button", { class: "btn sm", onclick: () => { state.paying = { member: m }; state.receipt = null; draw(); } }, "Cobrar") : null,
          h("button", { class: s === "vencida" || s === "sin-plan" ? "btn ghost sm" : "btn sm",
            onclick: () => run(() => db.checkIn(m.id), s === "vencida" ? `Ingreso de ${m.name} registrado (cuota vencida).` : `Ingreso de ${m.name} registrado.`) },
            s === "vencida" || s === "sin-plan" ? "Ingresar igual" : "Registrar ingreso")));
    }) : [h("p", { class: "muted" }, "No se encontró ningún socio activo.")]));
  };
  search.addEventListener("input", paint);
  paint();

  return h("div", {},
    h("div", { class: "panel" }, h("h2", {}, "Registrar ingreso"), search, list),
    h("div", { class: "panel" }, h("h2", {}, `Ingresos de hoy (${todays.length})`),
      todays.length ? h("div", { class: "table-wrap" }, h("table", {}, h("tbody", {}, todays.map((c) => h("tr", {}, h("td", {}, timeOf(c.created_at)), h("td", {}, nameOf(c.member_id))))))) :
        h("p", { class: "muted" }, "Todavía no hay ingresos hoy.")));
}

// ---------- Cobranza ----------
function viewCobranza() {
  const live = state.members.filter((m) => m.active !== false && m.expires_on);
  const overdue = live.filter((m) => statusOf(m) === "vencida").sort((a, b) => a.expires_on.localeCompare(b.expires_on));
  const soon = live.filter((m) => statusOf(m) === "por-vencer").sort((a, b) => a.expires_on.localeCompare(b.expires_on));
  const table = (title, rows, empty) => h("div", { class: "panel" }, h("h2", {}, `${title} (${rows.length})`),
    rows.length ? h("div", { class: "table-wrap" }, h("table", {}, h("tbody", {}, rows.map((m) => h("tr", {},
      h("td", {}, h("strong", {}, m.name), h("div", { class: "muted small" }, `${planOf(m.plan_id)?.name || "Sin plan"} · vence ${fmtDate(m.expires_on)} (${dueText(m)})`)),
      h("td", { class: "right" }, h("div", { class: "actions" },
        m.phone ? h("a", { class: "btn wa sm", target: "_blank", rel: "noopener", href: whatsappLink(m.phone, reminderMessage(m, GYM.name, today())) }, "WhatsApp") : h("span", { class: "muted small" }, "Sin teléfono"),
        h("button", { class: "btn sm", onclick: () => { state.paying = { member: m }; state.receipt = null; draw(); } }, "Cobrar")))))))) :
      h("p", { class: "muted" }, empty));
  return h("div", {}, table("Cuotas vencidas", overdue, "No hay cuotas vencidas. 🎉"), table("Por vencer en 7 días", soon, "Nada por vencer esta semana."));
}

// ---------- Planes ----------
function planForm() {
  const p = state.editingPlan;
  const name = h("input", { value: p.name, required: true, maxlength: "60" });
  const price = h("input", { type: "number", min: "0", step: "1", value: p.price ?? "", required: true });
  const days = h("input", { type: "number", min: "1", max: "366", step: "1", value: p.days ?? 30, required: true });
  const desc = h("input", { value: p.description, maxlength: "160" });
  const active = h("select", {}, h("option", { value: "1", selected: p.active !== false }, "Activo (visible en el sitio)"), h("option", { value: "0", selected: p.active === false }, "Oculto"));
  const msg = h("p", { class: "msg", role: "alert" });
  return h("form", { class: "panel", onsubmit: (e) => {
    e.preventDefault();
    if (!name.value.trim() || !(Number(price.value) >= 0) || !(Number(days.value) >= 1)) { msg.textContent = "Revisá nombre, precio y duración."; return; }
    const row = { name: name.value.trim(), price: Number(price.value), days: Math.round(Number(days.value)), description: desc.value.trim(), active: active.value === "1" };
    if (p.id) row.id = p.id;
    run(async () => { await db.savePlan(row); state.editingPlan = null; await reload(); }, "Plan guardado.");
  } },
    h("h2", {}, p.id ? "Editar plan" : "Nuevo plan"),
    h("div", { class: "form-grid" }, field("Nombre", name), field("Precio ($)", price), field("Duración (días)", days), field("Estado", active), field("Descripción", desc, "full")),
    msg,
    h("div", { class: "actions" }, h("button", { class: "btn", type: "submit" }, "Guardar"),
      h("button", { class: "btn ghost", type: "button", onclick: () => { state.editingPlan = null; draw(); } }, "Cancelar")));
}

function viewPlanes() {
  return h("div", {},
    state.editingPlan ? planForm() : null,
    h("div", { class: "toolbar" }, h("button", { class: "btn", onclick: () => { state.editingPlan = { active: true }; draw(); } }, "Nuevo plan")),
    h("div", { class: "table-wrap" }, h("table", {},
      h("thead", {}, h("tr", {}, h("th", {}, "Plan"), h("th", {}, "Precio"), h("th", {}, "Duración"), h("th", {}, "Estado"), h("th", {}))),
      h("tbody", {}, state.plans.map((p) => h("tr", {},
        h("td", {}, h("strong", {}, p.name), h("div", { class: "muted small" }, p.description || "")),
        h("td", {}, money(p.price)), h("td", {}, `${p.days} días`),
        h("td", {}, badge(p.active ? "al-dia" : "inactivo")),
        h("td", { class: "right" }, h("button", { class: "btn ghost sm", onclick: () => { state.editingPlan = p; draw(); } }, "Editar"))))))));
}

// ---------- Shell ----------
const VIEWS = { resumen: viewResumen, socios: viewSocios, checkin: viewCheckin, cobranza: viewCobranza, planes: viewPlanes };

async function draw() {
  const flash = state.flash;
  state.flash = null;
  let content;
  try { content = await VIEWS[state.tab](); } catch (e) { console.error(e); content = h("p", { class: "msg" }, "No se pudieron cargar los datos."); }
  // replaceChildren convierte null en el texto "null": filtrar antes de pasar.
  root.replaceChildren(...[
    demoNotice(db.isDemo),
    h("nav", { class: "tabs", "aria-label": "Secciones" }, TABS.map(([id, label]) =>
      h("button", { class: `tab${state.tab === id ? " on" : ""}`, "aria-current": state.tab === id ? "page" : false,
        onclick: () => { state.tab = id; state.editing = null; state.editingPlan = null; state.paying = null; state.receipt = null; draw(); } }, label))),
    flash ? h("p", { class: `msg${flash.ok ? " ok" : ""}`, role: "status" }, flash.text) : null,
    state.paying ? payPanel() : null,
    state.receipt ? receiptPanel() : null,
    content,
  ].filter(Boolean));
  $("[autofocus]", root)?.focus();
}

async function start() {
  logoutBtn.hidden = false;
  await reload();
  await draw();
}

logoutBtn.addEventListener("click", async () => { await db.logout(); loginView(); });

(async () => {
  try {
    if ((await db.isLoggedIn()) && (await db.isStaff())) await start(); else loginView();
  } catch (e) {
    console.error(e);
    loginView("No se pudo conectar con la base de datos.");
  }
})();
