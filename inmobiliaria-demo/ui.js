// Helpers de DOM. Todo el texto entra por textContent: sin innerHTML con datos de usuario.
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const $ = (sel, root = document) => root.querySelector(sel);

export function demoNotice(isDemo) {
  return isDemo
    ? h("div", { class: "notice" }, "Modo demo: los datos se guardan solo en este navegador. Panel: admin / admin.")
    : null;
}

// Íconos de trazo (24x24). Los paths son constantes del código, nunca datos de usuario.
const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  building: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  columns: '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M9 4v16M15 4v16"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><path d="M16 5a3.5 3.5 0 0 1 0 6M18 14c2 .8 3 2.8 3 6"/>',
  settings: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="1"/><path d="M4 10h16M9 3v4M15 3v4M9 15l2 2 4-4"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
  x: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>',
};

export function icon(name) {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  for (const [k, v] of Object.entries({ viewBox: "0 0 24 24", width: "20", height: "20", fill: "none", stroke: "currentColor", "stroke-width": "1.7", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" })) {
    svg.setAttribute(k, v);
  }
  svg.innerHTML = ICONS[name] ?? "";
  return svg;
}

export function relTime(iso) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  if (min < 60 * 24) return `hace ${Math.round(min / 60)} h`;
  return `hace ${Math.round(min / 1440)} d`;
}

// Formulario genérico. fields: [{ key, label, type, options, required, full, value }]
export function formPanel({ title, fields, submitLabel = "Guardar", onSubmit, onCancel }) {
  const inputs = {};
  const grid = h("div", { class: "form-grid" });
  for (const f of fields) {
    let el;
    if (f.options) {
      el = h("select", {}, f.options.map((o) => {
        const [v, l] = Array.isArray(o) ? o : [o, o];
        return h("option", { value: v, selected: f.value === v }, l);
      }));
    } else if (f.type === "textarea") {
      el = h("textarea", { rows: "2" }, f.value ?? "");
    } else {
      el = h("input", {
        type: f.type || "text", value: f.value ?? "", required: !!f.required,
        ...(f.type === "number" ? { min: "0", step: "any" } : {}),
      });
    }
    inputs[f.key] = el;
    grid.append(h("div", { class: f.full ? "full" : "" }, h("label", {}, f.label), el));
  }
  const msg = h("p", { class: "msg" });
  const form = h("form", { class: "panel" },
    title ? h("h2", {}, title) : null, grid,
    h("div", { class: "actions" },
      h("button", { class: "btn", type: "submit" }, submitLabel),
      onCancel ? h("button", { class: "btn ghost", type: "button", onclick: onCancel }, "Cancelar") : null),
    msg);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const values = {};
    for (const f of fields) {
      const v = inputs[f.key].value;
      values[f.key] = f.type === "number" ? Number(v) || 0 : v.trim();
    }
    try { await onSubmit(values); } catch (err) { msg.textContent = `No se pudo guardar: ${err.message}`; }
  });
  return form;
}
