import { listLeads, updateLead, deleteLead, listProperties, collection } from "./data.js";
import { usd, whatsappLink } from "./format.js";
import { h, formPanel, relTime } from "./ui.js";

const contactsDb = collection("contacts");
const dealsDb = collection("deals");
const callsDb = collection("calls");
const visitsDb = collection("visits");

const pageHead = (title, ...actions) => h("div", { class: "page-head" }, h("h1", {}, title), h("div", { class: "actions", style: "margin:0" }, actions));
const waFor = (phone, text = "Hola!") => (String(phone).replace(/\D/g, "").length >= 8 ? whatsappLink(phone, text) : null);
const fmtDate = (iso) => new Date(iso).toLocaleString("es-UY", { dateStyle: "short", timeStyle: "short" });

// ---------- Conversaciones (consultas recibidas desde el sitio) ----------
export async function conversations(root, only = "") {
  const [leads, props] = await Promise.all([listLeads(), listProperties({ includeClosed: true })]);
  const again = (f = only) => conversations(root, f);
  const shown = leads.filter((l) => !only || l.status === only);

  const card = (l) => {
    const isEmail = l.contact.includes("@");
    const wa = !isEmail && waFor(l.contact, `Hola ${l.name}! Te escribimos por tu consulta sobre "${l.property_label}".`);
    const actions = h("div", { class: "actions" });
    const act = (label, cls, fn) => h("button", { class: `btn ${cls}`, onclick: async () => { try { await fn(); } catch (err) { alert(err.message); } } }, label);

    const schedule = () => {
      const when = h("input", { type: "datetime-local", required: true });
      actions.replaceChildren(when, act("Confirmar visita", "", async () => {
        if (!when.value) return;
        await visitsDb.add({ property_label: l.property_label, contact_name: l.name || "Sin nombre", at: new Date(when.value).toISOString(), status: "confirmada" });
        await updateLead(l.id, { status: "respondido" });
        again();
      }), act("Cancelar", "ghost", () => again()));
    };

    actions.append(
      wa ? h("a", { class: "btn wa", href: wa, target: "_blank", rel: "noopener" }, "Responder por WhatsApp") : null,
      isEmail ? h("a", { class: "btn ghost", href: `mailto:${l.contact}` }, "Responder por email") : null,
      act("Agendar visita", "ghost", schedule),
      act("Pasar al pipeline", "ghost", async () => {
        const prop = props.find((p) => p.id === l.property_id);
        if (l.name) await contactsDb.add({ name: l.name, phone: isEmail ? "" : l.contact, email: isEmail ? l.contact : "", role: "comprador", notes: l.message });
        await dealsDb.add({
          title: l.property_label, contact_name: l.name || "Sin nombre", property_label: l.property_label, stage: "consulta",
          value: prop?.operation === "venta" ? prop.price : 0, commission_pct: 3, stage_at: new Date().toISOString(), closed_at: null,
        });
        await updateLead(l.id, { status: "respondido" });
        location.hash = "#/pipeline";
      }),
      l.status !== "respondido" ? act("Marcar respondida", "ghost", async () => { await updateLead(l.id, { status: "respondido" }); again(); }) : null,
      act("×", "danger", async () => { if (confirm("¿Borrar esta conversación?")) { await deleteLead(l.id); again(); } }));

    const thread = l.messages ?? [];
    const badge = { nuevo: ["reservada", "nuevo"], atencion: ["cerrada", "requiere atención"], respondido: ["disponible", "respondido"] }[l.status] ?? ["", l.status];
    return h("article", { class: `convo ${l.status}` },
      h("div", { class: "convo-head" },
        h("strong", {}, l.name || (l.kind === "chat" ? "Visitante (chat)" : "Visitante (click en WhatsApp)")),
        h("span", { class: `badge ${badge[0]}` }, badge[1]),
        l.kind === "chat" ? h("span", { class: "badge" }, "chat con IA") : null,
        h("small", { class: "muted" }, relTime(l.created_at))),
      h("div", { class: "muted" }, `${l.property_label}${l.contact ? ` · ${l.contact}` : ""}`),
      thread.length
        ? h("details", { open: l.status === "atencion" },
            h("summary", {}, `Ver conversación (${thread.length} mensajes)`),
            h("div", { class: "transcript" }, thread.map((m) =>
              h("div", { class: `bubble ${m.role === "user" ? "me" : "bot"}` }, m.text))))
        : (l.message ? h("p", {}, l.message) : null),
      actions);
  };

  root.replaceChildren(
    pageHead("Conversaciones",
      h("button", { class: `btn ${only ? "ghost" : ""}`, onclick: () => again("") }, "Todas"),
      h("button", { class: `btn ${only === "atencion" ? "" : "ghost"}`, onclick: () => again("atencion") },
        `Requieren atención (${leads.filter((l) => l.status === "atencion").length})`),
      h("button", { class: `btn ${only === "nuevo" ? "" : "ghost"}`, onclick: () => again("nuevo") },
        `Nuevas (${leads.filter((l) => l.status === "nuevo").length})`)),
    h("div", { class: "stack" }, shown.length ? shown.map(card) : h("p", { class: "muted" }, "No hay conversaciones.")));
}

// ---------- Pipeline ----------
const STAGES = [
  ["consulta", "Consulta"], ["visita", "Visita"], ["negociacion", "Negociación"],
  ["sena", "Seña"], ["cerrado", "Cerrado"], ["perdido", "Perdido"],
];

export async function pipeline(root, adding = false) {
  const [deals, props] = await Promise.all([dealsDb.list(), listProperties({ includeClosed: true })]);
  const again = () => pipeline(root);

  const move = async (d, stage) => {
    const at = new Date().toISOString();
    await dealsDb.update(d.id, { stage, stage_at: at, closed_at: stage === "cerrado" ? at : null });
    again();
  };

  const card = (d) => {
    const sel = h("select", {}, STAGES.map(([v, l]) => h("option", { value: v, selected: d.stage === v }, l)));
    sel.addEventListener("change", () => move(d, sel.value).catch((err) => alert(err.message)));
    return h("div", { class: "deal" },
      h("strong", {}, d.title),
      h("small", { class: "muted" }, d.contact_name),
      h("div", { class: "deal-val" }, usd(d.value), h("small", {}, ` · comisión ${usd((d.value * d.commission_pct) / 100)}`)),
      h("div", { class: "deal-foot" }, sel,
        h("button", { class: "btn danger", title: "Eliminar", onclick: async () => {
          if (confirm(`¿Eliminar "${d.title}"?`)) { await dealsDb.remove(d.id); again(); }
        } }, "×")));
  };

  const form = adding
    ? formPanel({
        title: "Nueva operación",
        fields: [
          { key: "title", label: "Operación", required: true, full: true },
          { key: "contact_name", label: "Cliente", required: true },
          { key: "property_label", label: "Propiedad", options: ["", ...props.filter((p) => p.operation === "venta").map((p) => p.title)] },
          { key: "value", label: "Valor (US$)", type: "number", required: true },
          { key: "commission_pct", label: "Comisión %", type: "number", value: 3 },
          { key: "stage", label: "Etapa", options: STAGES, value: "consulta" },
        ],
        onSubmit: async (v) => {
          const at = new Date().toISOString();
          await dealsDb.add({ ...v, stage_at: at, closed_at: v.stage === "cerrado" ? at : null });
          again();
        },
        onCancel: again,
      })
    : null;

  root.replaceChildren(
    pageHead("Pipeline", h("button", { class: "btn", onclick: () => pipeline(root, true) }, "+ Nueva operación")),
    form,
    h("div", { class: "kanban" }, STAGES.map(([stage, label]) => {
      const col = deals.filter((d) => d.stage === stage);
      return h("section", { class: `col ${stage}` },
        h("div", { class: "col-head" }, h("strong", {}, label), h("small", {}, `${col.length} · ${usd(col.reduce((s, d) => s + d.value, 0))}`)),
        col.map(card));
    })));
}

// ---------- Llamadas ----------
export async function calls(root) {
  const rows = await callsDb.list();
  const form = formPanel({
    title: "Registrar llamada",
    fields: [
      { key: "contact_name", label: "Contacto", required: true },
      { key: "phone", label: "Teléfono" },
      { key: "direction", label: "Tipo", options: ["saliente", "entrante"] },
      { key: "outcome", label: "Resultado", options: ["contestó", "no contestó", "mensaje de voz"] },
      { key: "notes", label: "Notas", type: "textarea", full: true },
    ],
    onSubmit: async (v) => { await callsDb.add(v); calls(root); },
  });
  root.replaceChildren(
    pageHead("Llamadas"), form,
    h("div", { class: "card-box" },
      rows.length
        ? h("table", {}, h("thead", {}, h("tr", {}, ["Fecha", "Contacto", "Tipo", "Resultado", "Notas", ""].map((t) => h("th", {}, t)))),
            h("tbody", {}, rows.map((c) => h("tr", {},
              h("td", {}, fmtDate(c.created_at)), h("td", {}, c.contact_name, c.phone ? h("div", { class: "muted" }, c.phone) : null),
              h("td", {}, c.direction), h("td", {}, c.outcome), h("td", {}, c.notes),
              h("td", {}, h("button", { class: "btn danger", title: "Borrar", onclick: async () => { await callsDb.remove(c.id); calls(root); } }, "×"))))))
        : h("p", { class: "muted" }, "Todavía no hay llamadas registradas.")));
}

// ---------- Contactos ----------
export async function contacts(root, adding = false) {
  const rows = await contactsDb.list();
  const again = () => contacts(root);
  const search = h("input", { placeholder: "Buscar por nombre, teléfono o email…" });
  const body = h("tbody");
  const draw = () => {
    const q = search.value.trim().toLowerCase();
    body.replaceChildren(...rows.filter((c) => `${c.name} ${c.phone} ${c.email}`.toLowerCase().includes(q)).map((c) => {
      const wa = waFor(c.phone);
      return h("tr", {},
        h("td", {}, h("strong", {}, c.name), c.notes ? h("div", { class: "muted" }, c.notes) : null),
        h("td", {}, c.role), h("td", {}, c.phone), h("td", {}, c.email),
        h("td", {},
          wa ? h("a", { class: "btn wa", href: wa, target: "_blank", rel: "noopener" }, "WhatsApp") : null, " ",
          h("button", { class: "btn danger", title: "Borrar", onclick: async () => { if (confirm(`¿Borrar a ${c.name}?`)) { await contactsDb.remove(c.id); again(); } } }, "×")));
    }));
  };
  search.addEventListener("input", draw);
  draw();

  const form = adding
    ? formPanel({
        title: "Nuevo contacto",
        fields: [
          { key: "name", label: "Nombre", required: true },
          { key: "role", label: "Tipo", options: ["comprador", "vendedor", "inquilino", "propietario"] },
          { key: "phone", label: "Teléfono (con código de país)" },
          { key: "email", label: "Email", type: "email" },
          { key: "notes", label: "Notas", type: "textarea", full: true },
        ],
        onSubmit: async (v) => { await contactsDb.add(v); again(); },
        onCancel: again,
      })
    : null;

  root.replaceChildren(
    pageHead("Contactos", h("button", { class: "btn", onclick: () => contacts(root, true) }, "+ Nuevo contacto")),
    form,
    h("div", { class: "card-box" }, search,
      h("table", {}, h("thead", {}, h("tr", {}, ["Nombre", "Tipo", "Teléfono", "Email", ""].map((t) => h("th", {}, t)))), body)));
}
