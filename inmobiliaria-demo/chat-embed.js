// Chat embebido: se muestra dentro del widget que la inmobiliaria instala en su web.
import { getAgencyBySlug } from "./data.js";
import { createChat } from "./chat-ui.js";
import { h, $ } from "./ui.js";

const slug = (new URLSearchParams(location.search).get("agency") || "").toLowerCase();
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
