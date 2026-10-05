import { listVehicles, getSettings, isDemo } from "./data.js";
import { money } from "./quote.js";
import { h, $, demoNotice } from "./ui.js";

const state = { cars: [] };

const fill = (select, values) => {
  for (const v of [...new Set(values)].sort()) select.append(h("option", { value: v }, v));
};

function visible() {
  const brand = $("#f-brand").value;
  const fuel = $("#f-fuel").value;
  const year = Number($("#f-year").value) || 0;
  const max = Number($("#f-max").value) || Infinity;
  const sort = $("#f-sort").value;
  const list = state.cars.filter((c) =>
    (!brand || c.brand === brand) && (!fuel || c.fuel === fuel) && c.year >= year && c.price <= max);
  const by = {
    "price-asc": (a, b) => a.price - b.price,
    "price-desc": (a, b) => b.price - a.price,
    "year-desc": (a, b) => b.year - a.year,
    new: (a, b) => b.created_at.localeCompare(a.created_at),
  }[sort];
  return list.sort(by);
}

function render() {
  const list = visible();
  $("#count").textContent = `${list.length} ${list.length === 1 ? "auto" : "autos"}`;
  const grid = $("#grid");
  grid.replaceChildren(
    ...(list.length
      ? list.map((c) =>
          h("a", { class: "card", href: `vehicle.html#${encodeURIComponent(c.id)}` },
            h("img", { src: c.photos?.[0] || "", alt: `${c.brand} ${c.model}`, loading: "lazy" }),
            h("div", { class: "body" },
              h("h3", {}, `${c.brand} ${c.model}`),
              h("span", { class: "muted" }, `${c.year} · ${c.km.toLocaleString("es-AR")} km · ${c.transmission}`),
              h("div", {}, h("span", { class: `badge ${c.status}` }, c.status)),
              h("div", { class: "price" }, money(c.price, c.currency)))))
      : [h("p", { class: "muted" }, "No hay autos con esos filtros.")]));
}

try {
  const [cars, settings] = await Promise.all([listVehicles(), getSettings()]);
  state.cars = cars;
  $("#biz").textContent = settings.business_name;
  document.title = `${settings.business_name} · Autos`;
  const n = demoNotice(isDemo);
  if (n) $("#notice").append(n);
  fill($("#f-brand"), cars.map((c) => c.brand));
  fill($("#f-fuel"), cars.map((c) => c.fuel));
  for (const el of document.querySelectorAll(".filters input, .filters select")) {
    el.addEventListener("input", render);
  }
  render();
} catch (e) {
  $("#grid").replaceChildren(h("p", { class: "msg" }, `No se pudo cargar el catálogo: ${e.message}`));
}
