import { listProperties, getSettings, listLeads, collection } from "./data.js";
import { usd } from "./format.js";
import { h, icon, relTime } from "./ui.js";

const DAYS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
const SLOTS = ["9-11", "11-13", "13-15", "15-17", "17-19", "19-21"];

const now = new Date();
const inMonth = (iso) => {
  const d = new Date(iso);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};
const commission = (d) => (d.value * d.commission_pct) / 100;
const pct = (v, goal) => (goal > 0 ? Math.min(100, Math.round((v / goal) * 100)) : 0);

const stat = (label, value, sub) =>
  h("div", { class: "kpi" }, h("small", {}, label), h("strong", {}, value), h("span", {}, sub));

const bar = (label, valueText, goalText, ratio, cls) =>
  h("div", { class: "goal" },
    h("div", { class: "goal-head" }, h("small", {}, label), h("span", {}, h("b", {}, valueText), ` / ${goalText}`)),
    h("div", { class: "bar" }, h("i", { class: cls, style: `width:${ratio}%` })));

// Visitas de las últimas 4 semanas (sin canceladas) por día y franja horaria.
function heatmap(visits) {
  const grid = DAYS.map(() => SLOTS.map(() => 0));
  const since = Date.now() - 28 * 864e5;
  for (const v of visits) {
    const t = new Date(v.at);
    if (v.status === "cancelada" || t.getTime() < since || t.getTime() > Date.now()) continue;
    const slot = Math.floor((t.getHours() - 9) / 2);
    if (slot < 0 || slot >= SLOTS.length) continue;
    grid[(t.getDay() + 6) % 7][slot] += 1;
  }
  const max = Math.max(1, ...grid.flat());
  return h("div", { class: "heat" },
    h("span", {}), ...SLOTS.map((s) => h("small", {}, s)),
    ...DAYS.flatMap((d, i) => [
      h("small", {}, d),
      ...grid[i].map((n) => h("div", { class: `cell l${n === 0 ? 0 : Math.ceil((n / max) * 5)}`, title: `${n} visitas` }, n || "")),
    ]));
}

function activity(props, leads, deals, visits, calls) {
  const events = [
    ...leads.map((l) => ({ at: l.created_at, icon: "chat", tone: "blue", text: `Nueva consulta: ${l.property_label}` })),
    ...visits.filter((v) => v.status === "confirmada").slice(0, 3).map((v) => ({ at: v.created_at, icon: "calendar", tone: "green", text: `Visita confirmada: ${v.property_label}` })),
    ...deals.map((d) => {
      const base = { at: d.stage_at };
      if (d.stage === "sena") return { ...base, icon: "check", tone: "terra", text: `Seña recibida: ${usd(d.value)} en ${d.title}` };
      if (d.stage === "perdido") return { ...base, icon: "x", tone: "red", text: `Operación caída: ${d.title}` };
      if (d.stage === "cerrado") return { ...base, icon: "key", tone: "green", text: `Cierre: ${d.title}` };
      return null;
    }).filter(Boolean),
    ...props.map((p) => ({ at: p.created_at, icon: "key", tone: "gold", text: `Captación nueva: ${p.title}` })),
    ...calls.map((c) => ({ at: c.created_at, icon: "phone", tone: "blue", text: `Llamada ${c.direction} con ${c.contact_name}` })),
  ].filter((e) => new Date(e.at).getTime() <= Date.now() + 6e4)
    .sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);
  return h("ul", { class: "feed" }, events.map((e) =>
    h("li", {}, h("span", { class: `ico ${e.tone}` }, icon(e.icon)),
      h("div", {}, h("div", {}, e.text), h("small", {}, relTime(e.at))))));
}

export async function render(root) {
  const [props, settings, leads, deals, visits, calls] = await Promise.all([
    listProperties({ includeClosed: true }), getSettings(), listLeads(),
    collection("deals").list(), collection("visits").list(), collection("calls").list(),
  ]);
  const closings = deals.filter((d) => d.stage === "cerrado" && d.closed_at && inMonth(d.closed_at));
  const listings = props.filter((p) => inMonth(p.created_at));
  const available = props.filter((p) => p.status === "disponible");
  const projected = deals
    .filter((d) => (d.stage === "cerrado" && d.closed_at && inMonth(d.closed_at)) || (d.stage === "sena" && inMonth(d.stage_at)))
    .reduce((sum, d) => sum + commission(d), 0);
  const { goal_closings: gc, goal_listings: gl, goal_commission: gm } = settings;
  const ratio = pct(projected, gm);

  root.replaceChildren(
    h("section", { class: "card-box head" },
      h("div", {}, h("h1", {}, "Panel general"), h("p", { class: "muted" }, `${settings.business_name} · cierre del mes en curso`)),
      h("div", { class: "kpis" },
        stat("Cierres del mes", `${closings.length}/${gc}`, "operaciones"),
        stat("Captaciones", `${listings.length}/${gl}`, "propiedades"),
        stat("En cartera", available.length, "disponibles"))),
    h("div", { class: "dash-grid" },
      h("section", { class: "card-box" },
        h("h3", { class: "sec" }, "Metas del mes"),
        bar("Cierres", closings.length, gc, pct(closings.length, gc), "dark"),
        bar("Captaciones", listings.length, gl, pct(listings.length, gl), "terra"),
        bar("Comisión", usd(projected), usd(gm), ratio, "green")),
      h("section", { class: "card-box commission" },
        h("small", {}, "Comisión proyectada del mes"),
        h("div", { class: "big" }, usd(projected)),
        h("p", {}, "objetivo ", h("b", {}, usd(gm))),
        h("div", { class: "bar" }, h("i", { class: "terra", style: `width:${ratio}%` })),
        h("span", { class: "pill" }, `${ratio}% del objetivo`)),
      h("section", { class: "card-box" },
        h("div", { class: "sec-row" }, h("h3", { class: "sec" }, "Visitas por franja"), h("small", {}, "franjas de mayor demanda · últimas 4 semanas")),
        heatmap(visits)),
      h("section", { class: "card-box" },
        h("h3", { class: "sec" }, "Actividad"),
        activity(props, leads, deals, visits, calls))));
}
