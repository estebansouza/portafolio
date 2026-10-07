// Helpers de DOM. Todo el texto entra por textContent: sin innerHTML con datos de usuario.
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") el.className = v;
    else if (k === "value") el.value = v ?? "";
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
