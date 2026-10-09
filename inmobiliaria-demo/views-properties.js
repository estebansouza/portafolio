import { listProperties, saveProperty, deleteProperty, getSettings, uploadPhoto } from "./data.js";
import { usd, TYPES, OPERATIONS, STATUSES } from "./format.js";
import { h } from "./ui.js";

const field = (label, input, cls = "") => h("div", { class: cls }, h("label", {}, label), input);

function propertyForm(v, settings, onDone) {
  const p = {
    photos: [], operation: "venta", type: "casa", status: "disponible",
    country: settings.country, city: settings.city, ...v,
  };
  const text = (k, type = "text", required = true) =>
    h("input", { type, value: p[k] ?? "", required, ...(type === "number" ? { min: "0", step: "any" } : {}) });
  const sel = (k, opts) => h("select", {}, opts.map((o) => h("option", { value: o, selected: p[k] === o }, o)));
  const f = {
    title: text("title"), operation: sel("operation", OPERATIONS), type: sel("type", TYPES),
    price: text("price", "number"), area_m2: text("area_m2", "number", false),
    bedrooms: text("bedrooms", "number", false), bathrooms: text("bathrooms", "number", false),
    garage: text("garage", "number", false),
    country: text("country", "text", false), city: text("city", "text", false), neighborhood: text("neighborhood", "text", false),
    status: sel("status", STATUSES),
    description: h("textarea", { rows: "3" }, p.description || ""),
  };
  const photoList = h("div", { class: "photo-list" });
  const drawPhotos = () => photoList.replaceChildren(...p.photos.map((src, i) =>
    h("div", {}, h("img", { src, alt: "" }),
      h("button", { type: "button", title: "Quitar", onclick: () => { p.photos.splice(i, 1); drawPhotos(); } }, "×"))));
  drawPhotos();
  const file = h("input", { type: "file", accept: "image/*", multiple: true });
  file.addEventListener("change", async () => {
    msg.textContent = "Subiendo fotos…";
    try {
      for (const fl of file.files) {
        if (p.photos.length >= 10) break;
        p.photos.push(await uploadPhoto(fl));
      }
      msg.textContent = "";
      drawPhotos();
    } catch (err) { msg.textContent = `No se pudo subir: ${err.message}`; }
    file.value = "";
  });
  const msg = h("p", { class: "msg" });

  const form = h("form", { class: "panel" },
    h("h2", {}, p.id ? "Editar propiedad" : "Nueva propiedad"),
    h("div", { class: "form-grid" },
      field("Título", f.title, "full"),
      field("Operación", f.operation), field("Tipo", f.type), field("Precio (US$, alquiler: por mes)", f.price),
      field("Superficie m²", f.area_m2), field("Dormitorios", f.bedrooms), field("Baños", f.bathrooms), field("Cocheras", f.garage),
      field("País", f.country), field("Ciudad", f.city), field("Barrio", f.neighborhood), field("Estado", f.status),
      field("Descripción", f.description, "full"),
      field("Fotos (máx. 10)", h("div", {}, file, photoList), "full")),
    h("div", { class: "actions" },
      h("button", { class: "btn", type: "submit" }, "Guardar"),
      h("button", { class: "btn ghost", type: "button", onclick: onDone }, "Cancelar")), msg);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const num = (el) => Number(el.value) || 0;
    try {
      await saveProperty({
        ...(p.id ? { id: p.id, created_at: p.created_at } : {}),
        title: f.title.value.trim(), operation: f.operation.value, type: f.type.value,
        price: num(f.price), area_m2: num(f.area_m2), bedrooms: Math.round(num(f.bedrooms)),
        bathrooms: Math.round(num(f.bathrooms)), garage: Math.round(num(f.garage)),
        country: f.country.value.trim(), city: f.city.value.trim(), neighborhood: f.neighborhood.value.trim(),
        status: f.status.value, description: f.description.value.trim(), photos: p.photos,
      });
      onDone();
    } catch (err) { msg.textContent = `No se pudo guardar: ${err.message}`; }
  });
  return form;
}

export async function render(root) {
  const [props, settings] = await Promise.all([listProperties({ includeClosed: true }), getSettings()]);
  const search = h("input", { placeholder: "Buscar por título, ciudad o barrio…" });
  const body = h("tbody");
  const edit = (v) => root.replaceChildren(propertyForm(v, settings, () => render(root)));

  const draw = () => {
    const q = search.value.trim().toLowerCase();
    body.replaceChildren(...props
      .filter((p) => `${p.title} ${p.city} ${p.neighborhood}`.toLowerCase().includes(q))
      .map((p) => {
        const status = h("select", {}, STATUSES.map((o) => h("option", { value: o, selected: p.status === o }, o)));
        status.addEventListener("change", async () => {
          try { await saveProperty({ ...p, status: status.value }); p.status = status.value; }
          catch (err) { alert(`No se pudo cambiar el estado: ${err.message}`); status.value = p.status; }
        });
        return h("tr", {},
          h("td", {}, p.photos?.[0] ? h("img", { src: p.photos[0], alt: "" }) : ""),
          h("td", {}, p.title, h("div", { class: "muted" }, `${p.operation} · ${p.type}`)),
          h("td", {}, usd(p.price, p.operation)),
          h("td", {}, status),
          h("td", {},
            h("button", { class: "btn ghost", onclick: () => edit(p) }, "Editar"), " ",
            h("button", { class: "btn danger", onclick: async () => {
              if (!confirm(`¿Eliminar "${p.title}"? No se puede deshacer.`)) return;
              try { await deleteProperty(p.id); render(root); } catch (err) { alert(err.message); }
            } }, "Eliminar")));
      }));
  };
  search.addEventListener("input", draw);
  draw();

  root.replaceChildren(
    h("div", { class: "page-head" },
      h("h1", {}, "Propiedades"),
      h("button", { class: "btn", onclick: () => edit({}) }, "+ Nueva propiedad")),
    h("div", { class: "card-box" },
      search,
      h("table", {}, h("thead", {}, h("tr", {}, ["", "Propiedad", "Precio", "Estado", ""].map((t) => h("th", {}, t)))), body)));
}
