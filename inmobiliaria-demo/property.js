import { getProperty, getAgencyById, logWhatsappClick, publicSettings } from "./data.js";
import { usd, whatsappLink, inquiryMessage, place } from "./format.js";
import { createChat } from "./chat-ui.js";
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

try {
  const p = await getProperty(id);
  const agency = p ? await getAgencyById(p.agency_id) : null;
  if (!p || !agency) {
    root.replaceChildren(h("p", { class: "muted" }, "Esa propiedad no está disponible."));
  } else {
    const settings = publicSettings(agency);
    $("#biz").textContent = settings.business_name;
    $("#back").href = `./?agency=${encodeURIComponent(agency.slug)}`;
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
            onclick: () => logWhatsappClick(p) }, "Consultar por WhatsApp")),
        h("div", { style: "margin-top:16px" }, createChat({ agency, property: p })))));
  }
} catch (e) {
  root.replaceChildren(h("p", { class: "msg" }, `Error: ${e.message}`));
}
