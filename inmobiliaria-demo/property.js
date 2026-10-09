import { getProperty, getSettings, addLead, saveChat } from "./data.js";
import { usd, whatsappLink, inquiryMessage, place } from "./format.js";
import { askAssistant } from "./assistant.js";
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

// Chat con el asistente: responde al instante y, si hace falta una persona, deja la
// conversación marcada "requiere atención" en el panel del dueño.
function chat(p, settings) {
  const session = crypto.randomUUID();
  const messages = [];
  let status = "nuevo";
  let busy = false;

  const name = h("input", { id: "c-name", maxlength: "80", placeholder: "Tu nombre", autocomplete: "name" });
  const contact = h("input", { id: "c-contact", maxlength: "120", placeholder: "Teléfono o email", autocomplete: "email" });
  const log = h("div", { class: "chat-log", role: "log", "aria-live": "polite" });
  const hint = h("p", { class: "muted", hidden: true }, "Dejá tu nombre y contacto arriba para que un asesor pueda escribirte.");
  const input = h("input", { id: "c-input", maxlength: "500", placeholder: "Escribí tu consulta…", autocomplete: "off" });
  const send = h("button", { class: "btn", type: "submit" }, "Enviar");

  const bubble = (m) => h("div", { class: `bubble ${m.role === "user" ? "me" : "bot"}` }, m.text);
  const persist = () => saveChat({ session, property: p, name: name.value.trim(), contact: contact.value.trim(), messages, status });
  const push = (role, text) => {
    const m = { role, text, at: new Date().toISOString() };
    messages.push(m);
    log.append(bubble(m));
    log.scrollTop = log.scrollHeight;
  };

  push("assistant", `¡Hola! Soy el asistente virtual de ${settings.business_name}. Preguntame lo que quieras sobre esta propiedad.`);
  messages.length = 0; // el saludo no cuenta como conversación hasta que el visitante escriba
  for (const el of [name, contact]) el.addEventListener("change", () => { if (messages.length) persist(); });

  const form = h("form", { class: "chat-form" }, input, send);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || busy) return;
    busy = true;
    input.value = "";
    send.disabled = true;
    push("user", text);
    const typing = h("div", { class: "bubble bot typing" }, "Escribiendo…");
    log.append(typing);
    log.scrollTop = log.scrollHeight;
    const { reply, handoff } = await askAssistant({ property: p, businessName: settings.business_name, messages });
    typing.remove();
    push("assistant", reply);
    if (handoff) {
      status = "atencion";
      hint.hidden = !!(contact.value.trim() || name.value.trim());
    }
    await persist();
    busy = false;
    send.disabled = false;
    input.focus();
  });

  return h("div", { class: "panel stack" },
    h("h2", {}, "Consultá con nuestro asistente"),
    h("div", { class: "form-grid" },
      h("div", {}, h("label", { for: "c-name" }, "Nombre (opcional)"), name),
      h("div", {}, h("label", { for: "c-contact" }, "Contacto (opcional)"), contact)),
    log, hint, form,
    h("small", {}, "Respuestas automáticas. Si hace falta, un asesor te contacta."));
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
        h("div", { style: "margin-top:16px" }, chat(p, settings)))));
  }
} catch (e) {
  root.replaceChildren(h("p", { class: "msg" }, `Error: ${e.message}`));
}
