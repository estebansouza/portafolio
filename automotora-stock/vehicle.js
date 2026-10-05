import { getVehicle, getSettings } from "./data.js";
import { calcInstallment, money, whatsappLink, inquiryMessage, quoteMessage } from "./quote.js";
import { h, $ } from "./ui.js";

const root = $("#root");
// El id va en el hash (vehicle.html#id): los redirects de "clean URLs" descartan el query string.
const id = decodeURIComponent(location.hash.slice(1)) || new URLSearchParams(location.search).get("id");

function gallery(v) {
  const photos = v.photos?.length ? v.photos : [""];
  const main = h("img", { class: "main", src: photos[0], alt: `${v.brand} ${v.model}` });
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

function quoter(v, settings, url) {
  const down = h("input", { id: "down", type: "number", min: "0", value: Math.round(v.price * 0.3) });
  const months = h("select", { id: "months" },
    [12, 18, 24, 36, 48, 60].map((m) => h("option", { value: m, selected: m === 36 }, `${m} cuotas`)));
  const tna = h("input", { id: "tna", type: "number", min: "0", step: "0.1", value: settings.tna });
  const monthlyOut = h("div", { class: "result" });
  const detail = h("p", { class: "muted" });
  const wa = h("a", { class: "btn wa", target: "_blank", rel: "noopener" }, "Enviar cotización por WhatsApp");

  const update = () => {
    const input = { down: Number(down.value) || 0, months: Number(months.value), tna: Number(tna.value) || 0 };
    const q = calcInstallment({ price: v.price, ...input });
    monthlyOut.textContent = `${money(q.monthly, v.currency)} / mes`;
    detail.textContent = `Financiás ${money(q.financed, v.currency)} · Total a pagar ${money(q.totalPaid, v.currency)}`;
    wa.href = whatsappLink(settings.whatsapp, quoteMessage(v, q, input, url));
  };
  for (const el of [down, months, tna]) el.addEventListener("input", update);
  update();

  return h("div", { class: "panel" },
    h("h2", {}, "Cotizá tu financiación"),
    h("div", { class: "row" },
      h("div", {}, h("label", { for: "down" }, "Anticipo"), down),
      h("div", {}, h("label", { for: "months" }, "Plazo"), months)),
    h("div", { class: "row" },
      h("div", {}, h("label", { for: "tna" }, "TNA %"), tna)),
    monthlyOut, detail,
    h("p", { class: "muted" }, "Cotización orientativa, sujeta a aprobación crediticia."),
    h("div", { class: "actions" }, wa));
}

try {
  const [v, settings] = await Promise.all([getVehicle(id), getSettings()]);
  $("#biz").textContent = settings.business_name;
  if (!v) {
    root.replaceChildren(h("p", { class: "muted" }, "Ese auto no está disponible."));
  } else {
    document.title = `${v.brand} ${v.model} ${v.year}`;
    const url = location.href;
    const spec = (label, value) => h("div", {}, h("small", {}, label), value);
    root.replaceChildren(h("div", { class: "detail" },
      h("div", {}, gallery(v)),
      h("div", {},
        h("h1", {}, `${v.brand} ${v.model}`),
        h("span", { class: `badge ${v.status}` }, v.status),
        h("div", { class: "price" }, money(v.price, v.currency)),
        h("div", { class: "specs" },
          spec("Año", v.year), spec("Kilómetros", `${v.km.toLocaleString("es-AR")} km`),
          spec("Combustible", v.fuel), spec("Transmisión", v.transmission)),
        h("p", {}, v.description),
        v.photo_credit ? h("p", { class: "muted", style: "font-size:.8rem" }, v.photo_credit) : null,
        h("div", { class: "actions" },
          h("a", { class: "btn wa", target: "_blank", rel: "noopener",
            href: whatsappLink(settings.whatsapp, inquiryMessage(v, url)) }, "Consultar por WhatsApp")),
        h("div", { style: "margin-top:16px" }, quoter(v, settings, url)))));
  }
} catch (e) {
  root.replaceChildren(h("p", { class: "msg" }, `Error: ${e.message}`));
}
