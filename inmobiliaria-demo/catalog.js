import { listProperties, getAgencyBySlug, isDemo } from "./data.js";
import { usd, filterProperties, sortProperties, place, TYPES } from "./format.js";
import { h, $, demoNotice } from "./ui.js";

// La inmobiliaria se elige con ?agency=<slug>; sin parámetro se muestra la de demostración.
const slug = (new URLSearchParams(location.search).get("agency") || "nexo").toLowerCase();
const state = { props: [], operation: "" };

function render() {
  const list = sortProperties(filterProperties(state.props, {
    operation: state.operation,
    type: $("#f-type").value,
    bedrooms: $("#f-beds").value,
    max: $("#f-max").value,
    q: $("#f-q").value,
  }), $("#f-sort").value);
  $("#count").textContent = `${list.length} ${list.length === 1 ? "propiedad" : "propiedades"}`;
  $("#grid").replaceChildren(
    ...(list.length
      ? list.map((p) =>
          h("a", { class: "card", href: `property.html#${encodeURIComponent(p.id)}` },
            h("div", { class: "ph" },
              h("img", { src: p.photos?.[0] || "", alt: p.title, loading: "lazy" }),
              h("span", { class: "badge op" }, p.operation)),
            h("div", { class: "body" },
              h("h3", {}, p.title),
              h("span", { class: "muted" }, place(p)),
              h("div", { class: "feats" },
                p.bedrooms ? h("span", {}, `${p.bedrooms} dorm.`) : null,
                p.bathrooms ? h("span", {}, `${p.bathrooms} baños`) : null,
                p.area_m2 ? h("span", {}, `${p.area_m2} m²`) : null),
              h("div", {}, h("span", { class: `badge ${p.status}` }, p.status)),
              h("div", { class: "price" }, usd(p.price, p.operation)))))
      : [h("p", { class: "muted" }, "No hay propiedades con esos filtros.")]));
}

try {
  const agency = await getAgencyBySlug(slug);
  if (!agency) {
    $("#grid").replaceChildren(h("p", { class: "muted" }, "No encontramos esa inmobiliaria."));
    $("#count").textContent = "";
  } else {
    const props = await listProperties({ agency });
    state.props = props;
    $("#biz").textContent = agency.name;
    document.title = `${agency.name} · Propiedades`;
    const n = demoNotice(isDemo);
    if (n) $("#notice").append(n);
    for (const t of TYPES) $("#f-type").append(h("option", { value: t }, t[0].toUpperCase() + t.slice(1)));
    for (const el of document.querySelectorAll(".filters input, .filters select")) el.addEventListener("input", render);
    for (const tab of document.querySelectorAll(".tab")) {
      tab.addEventListener("click", () => {
        state.operation = tab.dataset.op;
        document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("on", t === tab));
        render();
      });
    }
    render();
  }
} catch (e) {
  $("#grid").replaceChildren(h("p", { class: "msg" }, `No se pudo cargar el catálogo: ${e.message}`));
}
