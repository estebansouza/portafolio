import { isDemo, isLoggedIn, login, logout, getMyContext, setPanelAgency, sendPasswordReset, setNewPassword } from "./data.js";
import { session } from "./session.js";
import { h, $, icon, demoNotice } from "./ui.js";

const root = $("#root");
const logoutBtn = $("#logout");
logoutBtn.addEventListener("click", async () => {
  await logout();
  Object.assign(session, { email: "", isAdmin: false, memberships: [], agency: null, role: null });
  setPanelAgency(null);
  location.hash = "";
  start();
});

// Cada vista exporta render(root) y se carga recién cuando se abre.
const crm = () => import("./views-crm.js");
const VIEWS = {
  dashboard: { label: "Dashboard", icon: "dashboard", agency: true, load: () => import("./views-dashboard.js") },
  propiedades: { label: "Propiedades", icon: "building", agency: true, load: () => import("./views-properties.js") },
  conversaciones: { label: "Conversaciones", icon: "chat", agency: true, load: async () => ({ render: (await crm()).conversations }) },
  pipeline: { label: "Pipeline", icon: "columns", agency: true, load: async () => ({ render: (await crm()).pipeline }) },
  llamadas: { label: "Llamadas", icon: "phone", agency: true, load: async () => ({ render: (await crm()).calls }) },
  contactos: { label: "Contactos", icon: "users", agency: true, load: async () => ({ render: (await crm()).contacts }) },
  configuracion: { label: "Configuración", icon: "settings", agency: true, load: () => import("./views-settings.js") },
  // Herramientas del administrador: no aparece en el menú de la inmobiliaria (solo se abre escribiendo #/plataforma).
  plataforma: { label: "Plataforma", icon: "building", admin: true, hidden: true, load: () => import("./views-platform.js") },
};

// Secciones disponibles para este usuario.
const allowed = () => Object.entries(VIEWS).filter(([, v]) => (v.admin ? session.isAdmin : session.agency));

// Secciones que se muestran en el menú: las ocultas solo aparecen si el usuario no tiene ninguna inmobiliaria.
const menu = () => allowed().filter(([, v]) => !v.hidden || !session.agency);

const field = (label, input) => h("div", {}, h("label", {}, label), input);

function loginView() {
  document.body.classList.add("logged-out");
  logoutBtn.hidden = true;
  const email = h("input", { type: isDemo ? "text" : "email", autocomplete: "username", placeholder: isDemo ? "admin" : "tu@email.com" });
  const pass = h("input", { type: "password", autocomplete: "current-password" });
  const msg = h("p", { class: "msg" });
  const form = h("form", { class: "panel", style: "max-width:360px;margin:64px auto" },
    h("h2", {}, "Panel de la inmobiliaria"),
    h("p", { class: "muted" }, "Acceso solo para el equipo."),
    demoNotice(isDemo),
    field(isDemo ? "Usuario" : "Email", email), h("br"), field("Contraseña", pass), h("br"),
    h("button", { class: "btn", type: "submit" }, "Entrar"), msg,
    isDemo ? null : h("p", {}, h("a", { href: "#", class: "muted", onclick: (e) => { e.preventDefault(); forgotView(email.value.trim()); } }, "Olvidé mi contraseña")));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try { await login(email.value.trim(), pass.value); start(); }
    catch (err) { msg.textContent = isDemo ? err.message : "Email o contraseña incorrectos."; }
  });
  root.replaceChildren(form);
}

// Pide el email y envía el enlace para crear una contraseña nueva.
function forgotView(prefill = "") {
  const email = h("input", { type: "email", autocomplete: "username", placeholder: "tu@email.com", value: prefill });
  const msg = h("p", { class: "msg" });
  const form = h("form", { class: "panel", style: "max-width:360px;margin:64px auto" },
    h("h2", {}, "Recuperar contraseña"),
    h("p", { class: "muted" }, "Te enviamos por email un enlace para crear una contraseña nueva."),
    field("Email", email), h("br"),
    h("button", { class: "btn", type: "submit" }, "Enviar enlace"), msg,
    h("p", {}, h("a", { href: "#", class: "muted", onclick: (e) => { e.preventDefault(); loginView(); } }, "Volver")));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.className = "msg";
    try {
      await sendPasswordReset(email.value.trim());
      msg.className = "ok";
      msg.textContent = "Listo: si el email tiene cuenta, te llegará un enlace (revisá también el spam).";
    } catch { msg.textContent = "No se pudo enviar el email. Probá de nuevo en unos minutos."; }
  });
  root.replaceChildren(form);
}

// Se llega acá desde el enlace del email de recuperación.
function newPasswordView() {
  document.body.classList.add("logged-out");
  logoutBtn.hidden = true;
  const a = h("input", { type: "password", autocomplete: "new-password", minlength: 8, required: true });
  const b = h("input", { type: "password", autocomplete: "new-password", minlength: 8, required: true });
  const msg = h("p", { class: "msg" });
  const form = h("form", { class: "panel", style: "max-width:360px;margin:64px auto" },
    h("h2", {}, "Nueva contraseña"),
    h("p", { class: "muted" }, "Elegí una contraseña de al menos 8 caracteres."),
    field("Contraseña nueva", a), h("br"), field("Repetila", b), h("br"),
    h("button", { class: "btn", type: "submit" }, "Guardar y entrar"), msg);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (a.value !== b.value) { msg.textContent = "Las contraseñas no coinciden."; return; }
    try {
      await setNewPassword(a.value);
      history.replaceState(null, "", location.pathname);
      start();
    } catch (err) { msg.textContent = err.message; }
  });
  root.replaceChildren(form);
}

function currentView() {
  const name = location.hash.replace(/^#\/?/, "");
  const ok = allowed().map(([n]) => n);
  return ok.includes(name) ? name : ok[0];
}

async function route() {
  const name = currentView();
  if (!name) return;
  for (const a of document.querySelectorAll("#nav a")) a.classList.toggle("on", a.dataset.view === name);
  root.replaceChildren(h("p", { class: "muted" }, "Cargando…"));
  try {
    const mod = await VIEWS[name].load();
    if (name !== currentView()) return; // el usuario ya cambió de sección
    await mod.render(root);
  } catch (e) {
    root.replaceChildren(h("p", { class: "msg" }, `Error: ${e.message}`));
  }
}

function setActiveAgency(agencyId) {
  const m = session.memberships.find((x) => x.agency.id === agencyId) ?? session.memberships[0] ?? null;
  session.agency = m?.agency ?? null;
  session.role = m?.role ?? null;
  setPanelAgency(session.agency);
  try { if (session.agency) sessionStorage.setItem("inmo_active_agency", session.agency.id); } catch { /* sin storage */ }
}

function brandBlock() {
  const brand = $("#brand");
  const title = h("span", { id: "brand-name" }, session.agency?.name ?? "Plataforma");
  const parts = [title];
  if (session.memberships.length > 1) {
    const pick = h("select", { "aria-label": "Inmobiliaria", class: "brand-pick" },
      session.memberships.map((m) => h("option", { value: m.agency.id, selected: m.agency.id === session.agency?.id }, m.agency.name)));
    pick.addEventListener("change", () => { setActiveAgency(pick.value); shell(); });
    parts.push(pick);
  }
  brand.replaceChildren(...parts);
}

async function shell() {
  const ctx = await getMyContext();
  Object.assign(session, { email: ctx.email, isAdmin: ctx.isAdmin, memberships: ctx.memberships });
  let saved = null;
  try { saved = sessionStorage.getItem("inmo_active_agency"); } catch { /* sin storage */ }
  setActiveAgency(saved);

  if (!session.agency && !session.isAdmin) {
    document.body.classList.add("logged-out");
    logoutBtn.hidden = false;
    logoutBtn.style.cssText = "display:block;margin:0 auto";
    root.replaceChildren(h("div", { class: "panel", style: "max-width:420px;margin:64px auto" },
      h("h2", {}, "Sin acceso"),
      h("p", { class: "muted" }, "Tu cuenta todavía no pertenece a ninguna inmobiliaria. Pedile al administrador que te agregue al equipo."),
      h("button", { class: "btn", onclick: () => logoutBtn.click() }, "Salir")));
    return;
  }

  document.body.classList.remove("logged-out");
  logoutBtn.hidden = false;
  brandBlock();
  document.title = `Panel · ${session.agency?.name ?? "Plataforma"}`;
  $("#nav").replaceChildren(...menu().map(([name, v]) =>
    h("a", { href: `#/${name}`, "data-view": name }, icon(v.icon), v.label)));
  $("#site-link").href = session.agency ? `./?agency=${encodeURIComponent(session.agency.slug)}` : "./";
  await route();
}

window.addEventListener("hashchange", () => { if (!document.body.classList.contains("logged-out")) route(); });

async function start() {
  try {
    // Con el enlace de recuperación, isLoggedIn deja que Supabase lea la sesión temporal de la URL.
    if (!isDemo && /type=recovery/.test(location.hash)) { await isLoggedIn(); return newPasswordView(); }
    (await isLoggedIn()) ? await shell() : loginView();
  }
  catch (e) { root.replaceChildren(h("p", { class: "msg" }, `Error: ${e.message}`)); }
}
start();
