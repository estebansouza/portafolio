import { isDemo, isLoggedIn, login, logout, getSettings } from "./data.js";
import { h, $, icon, demoNotice } from "./ui.js";

const root = $("#root");
const logoutBtn = $("#logout");
logoutBtn.addEventListener("click", async () => { await logout(); location.hash = ""; start(); });

// Cada vista exporta render(root) y se carga recién cuando se abre.
const crm = () => import("./views-crm.js");
const VIEWS = {
  dashboard: { label: "Dashboard", icon: "dashboard", load: () => import("./views-dashboard.js") },
  propiedades: { label: "Propiedades", icon: "building", load: () => import("./views-properties.js") },
  conversaciones: { label: "Conversaciones", icon: "chat", load: async () => ({ render: (await crm()).conversations }) },
  pipeline: { label: "Pipeline", icon: "columns", load: async () => ({ render: (await crm()).pipeline }) },
  llamadas: { label: "Llamadas", icon: "phone", load: async () => ({ render: (await crm()).calls }) },
  contactos: { label: "Contactos", icon: "users", load: async () => ({ render: (await crm()).contacts }) },
  configuracion: { label: "Configuración", icon: "settings", load: () => import("./views-settings.js") },
};

const field = (label, input) => h("div", {}, h("label", {}, label), input);

function loginView() {
  document.body.classList.add("logged-out");
  logoutBtn.hidden = true;
  const email = h("input", { type: "text", autocomplete: "username", placeholder: isDemo ? "admin" : "email" });
  const pass = h("input", { type: "password", autocomplete: "current-password" });
  const msg = h("p", { class: "msg" });
  const form = h("form", { class: "panel", style: "max-width:360px;margin:64px auto" },
    h("h2", {}, "Ingresar"), demoNotice(isDemo),
    field("Usuario", email), h("br"), field("Contraseña", pass), h("br"),
    h("button", { class: "btn", type: "submit" }, "Entrar"), msg);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try { await login(email.value.trim(), pass.value); start(); }
    catch (err) { msg.textContent = err.message; }
  });
  root.replaceChildren(form);
}

function currentView() {
  const name = location.hash.replace(/^#\/?/, "");
  return VIEWS[name] ? name : "dashboard";
}

async function route() {
  const name = currentView();
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

async function shell() {
  document.body.classList.remove("logged-out");
  logoutBtn.hidden = false;
  const settings = await getSettings();
  $("#brand").textContent = settings.business_name;
  document.title = `Panel · ${settings.business_name}`;
  $("#nav").replaceChildren(...Object.entries(VIEWS).map(([name, v]) =>
    h("a", { href: `#/${name}`, "data-view": name }, icon(v.icon), v.label)));
  await route();
}

window.addEventListener("hashchange", () => { if (!document.body.classList.contains("logged-out")) route(); });

async function start() {
  try { (await isLoggedIn()) ? await shell() : loginView(); }
  catch (e) { root.replaceChildren(h("p", { class: "msg" }, `Error: ${e.message}`)); }
}
start();
