// Chat con el asistente (lo usan la ficha de la propiedad y el widget para webs ajenas).
// Responde al instante y, si hace falta una persona, deja la conversación marcada
// "requiere atención" en el panel de la inmobiliaria.
import { saveChat } from "./data.js";
import { askAssistant } from "./assistant.js";
import { h } from "./ui.js";

// agency: fila pública de la inmobiliaria; property: opcional (si falta, es un chat general).
export function createChat({ agency, property = null, compact = false }) {
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
  const persist = () => saveChat({ session, agency, property, name: name.value.trim(), contact: contact.value.trim(), messages, status });
  const push = (role, text) => {
    const m = { role, text, at: new Date().toISOString() };
    messages.push(m);
    log.append(bubble(m));
    log.scrollTop = log.scrollHeight;
  };

  // El saludo se muestra pero no cuenta como conversación hasta que el visitante escriba.
  log.append(bubble({
    role: "assistant",
    text: property
      ? `¡Hola! Soy el asistente virtual de ${agency.name}. Preguntame lo que quieras sobre esta propiedad.`
      : `¡Hola! Soy el asistente virtual de ${agency.name}. Contame qué estás buscando y te ayudo a encontrarlo.`,
  }));
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
    const { reply, handoff } = await askAssistant({ property, agency, businessName: agency.name, messages });
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

  return h("div", { class: `${compact ? "chat chat-compact" : "panel stack"}` },
    compact ? null : h("h2", {}, "Consultá con nuestro asistente"),
    h("div", { class: "form-grid" },
      h("div", {}, h("label", { for: "c-name" }, "Nombre (opcional)"), name),
      h("div", {}, h("label", { for: "c-contact" }, "Contacto (opcional)"), contact)),
    log, hint, form,
    h("small", {}, "Respuestas automáticas. Si hace falta, un asesor te contacta."));
}
