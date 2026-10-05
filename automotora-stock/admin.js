import {
  isDemo, isLoggedIn, login, logout, listVehicles, saveVehicle, deleteVehicle,
  getSettings, saveSettings, uploadPhoto,
} from "./data.js";
import { money } from "./quote.js";
import { h, $, demoNotice } from "./ui.js";

const root = $("#root");
const logoutBtn = $("#logout");
logoutBtn.addEventListener("click", async () => { await logout(); start(); });

const field = (label, input, cls = "") => h("div", { class: cls }, h("label", {}, label), input);

function loginView() {
  logoutBtn.hidden = true;
  const email = h("input", { type: "text", autocomplete: "username", placeholder: isDemo ? "admin" : "email" });
  const pass = h("input", { type: "password", autocomplete: "current-password" });
  const msg = h("p", { class: "msg" });
  const form = h("form", { class: "panel", style: "max-width:360px;margin:32px auto" },
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

function vehicleForm(v, onDone) {
  const car = { photos: [], currency: "ARS", fuel: "nafta", transmission: "manual", status: "disponible", ...v };
  const text = (k, type = "text") => h("input", { type, value: car[k] ?? "", required: true });
  const sel = (k, opts) => h("select", {}, opts.map((o) => h("option", { value: o, selected: car[k] === o }, o)));
  const f = {
    brand: text("brand"), model: text("model"), year: text("year", "number"), km: text("km", "number"),
    price: text("price", "number"), currency: sel("currency", ["ARS", "USD"]),
    fuel: sel("fuel", ["nafta", "diesel", "GNC", "híbrido", "eléctrico"]),
    transmission: sel("transmission", ["manual", "automática"]),
    status: sel("status", ["disponible", "reservado", "vendido"]),
    description: h("textarea", { rows: "3" }, car.description || ""),
  };
  const photoList = h("div", { class: "photo-list" });
  const drawPhotos = () => photoList.replaceChildren(...car.photos.map((src, i) =>
    h("div", {}, h("img", { src, alt: "" }),
      h("button", { type: "button", title: "Quitar", onclick: () => { car.photos.splice(i, 1); drawPhotos(); } }, "×"))));
  drawPhotos();
  const file = h("input", { type: "file", accept: "image/*", multiple: true });
  file.addEventListener("change", async () => {
    msg.textContent = "Subiendo fotos…";
    try {
      for (const fl of file.files) {
        if (car.photos.length >= 8) break;
        car.photos.push(await uploadPhoto(fl));
      }
      msg.textContent = "";
      drawPhotos();
    } catch (err) { msg.textContent = `No se pudo subir: ${err.message}`; }
    file.value = "";
  });
  const msg = h("p", { class: "msg" });

  const form = h("form", { class: "panel" },
    h("h2", {}, car.id ? "Editar auto" : "Nuevo auto"),
    h("div", { class: "form-grid" },
      field("Marca", f.brand), field("Modelo", f.model), field("Año", f.year), field("Km", f.km),
      field("Precio", f.price), field("Moneda", f.currency), field("Combustible", f.fuel),
      field("Transmisión", f.transmission), field("Estado", f.status),
      field("Descripción", f.description, "full"),
      field("Fotos (máx. 8)", h("div", {}, file, photoList), "full")),
    h("div", { class: "actions" },
      h("button", { class: "btn", type: "submit" }, "Guardar"),
      h("button", { class: "btn ghost", type: "button", onclick: onDone }, "Cancelar")), msg);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await saveVehicle({
        ...(car.id ? { id: car.id, created_at: car.created_at } : {}),
        brand: f.brand.value.trim(), model: f.model.value.trim(),
        year: Number(f.year.value), km: Number(f.km.value), price: Number(f.price.value),
        currency: f.currency.value, fuel: f.fuel.value, transmission: f.transmission.value,
        status: f.status.value, description: f.description.value.trim(), photos: car.photos,
      });
      onDone();
    } catch (err) { msg.textContent = `No se pudo guardar: ${err.message}`; }
  });
  return form;
}

function settingsForm(s) {
  const name = h("input", { value: s.business_name });
  const wa = h("input", { value: s.whatsapp, placeholder: "5491112345678" });
  const tna = h("input", { type: "number", min: "0", step: "0.1", value: s.tna });
  const msg = h("p", { class: "muted" });
  const form = h("form", { class: "panel" },
    h("h2", {}, "Configuración"),
    h("div", { class: "form-grid" },
      field("Nombre de la automotora", name), field("WhatsApp (con código de país)", wa), field("TNA por defecto %", tna)),
    h("div", { class: "actions" }, h("button", { class: "btn ghost", type: "submit" }, "Guardar configuración")), msg);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await saveSettings({ business_name: name.value.trim(), whatsapp: wa.value.trim(), tna: Number(tna.value) || 0 });
      msg.textContent = "Guardado.";
    } catch (err) { msg.textContent = `Error: ${err.message}`; }
  });
  return form;
}

async function dashboard() {
  logoutBtn.hidden = false;
  const [cars, settings] = await Promise.all([listVehicles({ includeSold: true }), getSettings()]);
  const search = h("input", { placeholder: "Buscar marca o modelo…" });
  const body = h("tbody");
  const edit = (v) => root.replaceChildren(vehicleForm(v, dashboard));

  const draw = () => {
    const q = search.value.trim().toLowerCase();
    body.replaceChildren(...cars
      .filter((c) => `${c.brand} ${c.model}`.toLowerCase().includes(q))
      .map((c) => {
        const status = h("select", {}, ["disponible", "reservado", "vendido"]
          .map((o) => h("option", { value: o, selected: c.status === o }, o)));
        status.addEventListener("change", async () => {
          try { await saveVehicle({ ...c, status: status.value }); c.status = status.value; }
          catch (err) { alert(`No se pudo cambiar el estado: ${err.message}`); status.value = c.status; }
        });
        return h("tr", {},
          h("td", {}, c.photos?.[0] ? h("img", { src: c.photos[0], alt: "" }) : ""),
          h("td", {}, `${c.brand} ${c.model} ${c.year}`),
          h("td", {}, money(c.price, c.currency)),
          h("td", {}, status),
          h("td", {},
            h("button", { class: "btn ghost", onclick: () => edit(c) }, "Editar"), " ",
            h("button", { class: "btn danger", onclick: async () => {
              if (!confirm(`¿Eliminar ${c.brand} ${c.model}? No se puede deshacer.`)) return;
              try { await deleteVehicle(c.id); dashboard(); } catch (err) { alert(err.message); }
            } }, "Eliminar")));
      }));
  };
  search.addEventListener("input", draw);
  draw();

  root.replaceChildren(
    demoNotice(isDemo),
    h("div", { class: "panel" },
      h("div", { class: "actions", style: "justify-content:space-between;margin:0 0 12px" },
        h("h2", { style: "margin:0" }, `Stock (${cars.length})`),
        h("button", { class: "btn", onclick: () => edit({}) }, "+ Nuevo auto")),
      search,
      h("table", {}, h("thead", {}, h("tr", {}, ["", "Auto", "Precio", "Estado", ""].map((t) => h("th", {}, t)))), body)),
    settingsForm(settings));
}

async function start() {
  try { (await isLoggedIn()) ? await dashboard() : loginView(); }
  catch (e) { root.replaceChildren(h("p", { class: "msg" }, `Error: ${e.message}`)); }
}
start();
