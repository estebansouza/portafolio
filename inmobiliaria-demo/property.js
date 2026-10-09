import { getProperty, getSettings, addLead } from "./data.js";
import { usd, whatsappLink, inquiryMessage, place } from "./format.js";
import { h, $ } from "./ui.js";

const root = $("#root");
// El id va en el hash (property.html#id): los redirects de "clean URLs" descartan el query string.
const id = decodeURIComponent(location.hash.slice(1)) || new URLSearchParams(location.search).get("id");

function gallery(p) {
  const photos = p.photos?.length ? p.photos : [""];
  const main = h("img", { class: "main", src: photos[0], alt: p.title });
  const thumbs = h("div", { class: "thumbs" });
  photos.forEach((src, i) => {
    const t = h("img", { src, alt: `Foto ${i + 1}`, class: i === 0 ? "on" : "" });
    t.addEventListener("click", () => {
      main.src = src;
      thumbs.querySelectorAll("img").forEach((x) => x.classList.toggle("on", x === t));
    });
    thumbs.append(t);
  });
  return h("div", { class: "gallery" }, main, photos.length > 1 ? thumbs : null);
}

function inquiryForm(p) {
  const name = h("input", { id: "i-name", required: true, maxlength: "80", autocomplete: "name" });
  const contact = h("input", { id: "i-contact", required: true, maxlength: "120", placeholder: "Teléfono o email", autocomplete: "email" });
  const message = h("textarea", { id: "i-msg", rows: "3", maxlength: "1000" }, `Hola, quisiera más información sobre "${p.title}".`);
  const msg = h("p", { class: "muted" });
  const form = h("form", { class: "panel stack" },
    h("h2", {}, "Dejá tu consulta"),
    h("div", {}, h("label", { for: "i-name" }, "Nombre"), name),
    h("div", {}, h("label", { for: "i-contact" }, "Contacto"), contact),
    h("div", {}, h("label", { for: "i-msg" }, "Mensaje"), message),
    h("button", { class: "btn", type: "submit" }, "Enviar consulta"), msg);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await addLead({ property: p, kind: "consulta", name: name.value.trim(), contact: contact.value.trim(), message: message.value.trim() });
      form.replaceChildren(h("h2", {}, "¡Gracias!"), h("p", { class: "ok" }, "Recibimos tu consulta. Te contactamos a la brevedad."));
    } catch (err) {
      msg.className = "msg";
      msg.textContent = `No se pudo enviar: ${err.message}`;
    }
  });
  return form;
}

try {
  const [p, settings] = await Promise.all([getProperty(id), getSettings()]);
  $("#biz").textContent = settings.business_name;
  if (!p) {
    root.replaceChildren(h("p", { class: "muted" }, "Esa propiedad no está disponible."));
  } else {
    document.title = `${p.title} · ${settings.business_name}`;
    const url = location.href;
    const spec = (label, value) => h("div", {}, h("small", {}, label), value);
    root.replaceChildren(h("div", { class: "detail" },
      h("div", {}, gallery(p)),
      h("div", {},
        h("h1", {}, p.title),
        h("p", { class: "muted" }, place(p)),
        h("span", { class: "badge op" }, p.operation), " ",
        h("span", { class: `badge ${p.status}` }, p.status),
        h("div", { class: "price" }, usd(p.price, p.operation)),
        h("div", { class: "specs" },
          spec("Tipo", p.type),
          spec("Superficie", p.area_m2 ? `${p.area_m2} m²` : "—"),
          spec("Dormitorios", p.bedrooms || "—"),
          spec("Baños", p.bathrooms || "—"),
          spec("Cocheras", p.garage || "—")),
        h("p", {}, p.description),
        h("div", { class: "actions" },
          h("a", { class: "btn wa", target: "_blank", rel: "noopener",
            href: whatsappLink(settings.whatsapp, inquiryMessage(p, url)),
            onclick: () => addLead({ property: p, kind: "whatsapp" }).catch(() => {}) }, "Consultar por WhatsApp")),
        h("div", { style: "margin-top:16px" }, inquiryForm(p)))));
  }
} catch (e) {
  root.replaceChildren(h("p", { class: "msg" }, `Error: ${e.message}`));
}
