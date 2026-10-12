// Chat embebido: se muestra dentro del widget que la inmobiliaria instala en su web.
import { getAgencyBySlug } from "./data.js";
import { createChat } from "./chat-ui.js";
import { h, $ } from "./ui.js";

const params = new URLSearchParams(location.search);
const slug = (params.get("agency") || "").toLowerCase();
// Color de marca de la web donde está instalado el widget (cabecera y botones del chat).
const brand = params.get("color") || "";
if (/^#[0-9a-fA-F]{3,8}$/.test(brand)) {
  document.documentElement.style.setProperty("--accent", brand);
  document.documentElement.style.setProperty("--yellow", "rgba(255,255,255,.45)");
}
const root = $("#root");

try {
  const agency = slug ? await getAgencyBySlug(slug) : null;
  if (!agency) {
    root.replaceChildren(h("p", { class: "muted", style: "padding:12px" }, "Este chat no está disponible."));
  } else {
    $("#biz").textContent = agency.name;
    document.title = `Chat · ${agency.name}`;
    root.replaceChildren(createChat({ agency, compact: true }));
  }
} catch (e) {
  root.replaceChildren(h("p", { class: "msg", style: "padding:12px" }, "No se pudo cargar el chat."));
}
