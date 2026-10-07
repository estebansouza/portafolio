// Página pública: horarios, planes y ubicación.
import { GYM } from "./config.js";
import { listPlans, isDemo } from "./data.js";
import { money, openNow, whatsappLink } from "./membership.js";
import { h, $, demoNotice } from "./ui.js";

const weekday = () => new Intl.DateTimeFormat("en-US", { timeZone: GYM.tz, weekday: "short" }).format(new Date());
const todayIndex = () => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday());

const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${GYM.address}, ${GYM.city}, Uruguay`)}`;

function hoursSection() {
  const today = todayIndex();
  const rows = GYM.hours.map((r) =>
    h("li", { class: r.days.includes(today) ? "today" : "" }, h("span", {}, r.label), h("span", {}, `${r.open} a ${r.close}`)));
  rows.push(h("li", { class: today === 0 ? "today" : "" }, h("span", {}, "Domingos"), h("span", {}, "Cerrado")));
  return h("section", { class: "section" }, h("h2", {}, "Horarios"), h("ul", { class: "hours-list" }, rows));
}

function planCard(p) {
  return h("div", { class: "card" },
    h("h3", {}, p.name),
    h("div", { class: "price" }, money(p.price), " ", h("small", {}, `/ ${p.days} días`)),
    h("p", { class: "muted" }, p.description || ""),
    h("a", { class: "btn ghost sm", href: whatsappLink(GYM.whatsapp, `Hola, quiero info sobre el plan ${p.name} en ${GYM.name}.`), target: "_blank", rel: "noopener" }, "Consultar por este plan"));
}

async function render() {
  const root = $("#root");
  const open = openNow(GYM.hours, new Date(), GYM.tz);
  const plans = await listPlans().catch(() => []);

  root.replaceChildren(...[
    demoNotice(isDemo),
    h("section", { class: "hero" },
      h("span", { class: `open-pill ${open ? "open" : "closed"}` }, open ? "Abierto ahora" : "Cerrado ahora"),
      h("h1", {}, GYM.tagline),
      h("p", { class: "muted" }, `${GYM.address} · ${GYM.city}`),
      h("div", { class: "actions" },
        h("a", { class: "btn wa", href: whatsappLink(GYM.whatsapp, `Hola, quiero consultar por ${GYM.name}.`), target: "_blank", rel: "noopener" }, "Escribinos por WhatsApp"),
        h("a", { class: "btn ghost", href: mapsUrl, target: "_blank", rel: "noopener" }, "Cómo llegar"))),
    hoursSection(),
    h("section", { class: "section" }, h("h2", {}, "Planes"),
      plans.length ? h("div", { class: "grid" }, plans.map(planCard)) : h("p", { class: "muted" }, "Consultanos por los planes disponibles.")),
    h("footer", {}, h("p", { class: "muted small" }, `${GYM.name} · ${GYM.address}, ${GYM.city}`)),
  ].filter(Boolean));
}

render();
