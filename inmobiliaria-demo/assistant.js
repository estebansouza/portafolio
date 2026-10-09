// Asistente de consultas. Intenta responder con IA (/api/chat) y, si el servidor no está
// disponible o no tiene API key, usa respuestas de respaldo basadas en reglas simples.
import { usd, place, norm } from "./format.js";

const has = (t, words) => words.some((w) => t.includes(w));

// Respuesta sin IA a partir de los datos de la propiedad. handoff = que intervenga una persona.
export function fallbackReply(p, text) {
  const t = norm(text);
  const out = (reply, handoff = false) => ({ reply, handoff, source: "respaldo" });
  const where = place(p) || "la zona indicada";

  if (has(t, ["negoci", "oferta", "descuento", "rebaja", "financ", "contraoferta", "reserv"])) {
    return out("Eso lo define el equipo comercial. Dejame tu nombre y un teléfono o email y un asesor te contacta para conversarlo.", true);
  }
  if (has(t, ["visita", "visitar", "conocer", "agendar", "coordinar", "horario", "ver la propiedad", "recorrer"])) {
    return out("¡Con gusto! Para coordinar una visita necesito tu nombre y un teléfono o email. Un asesor te confirma el horario a la brevedad.", true);
  }
  if (has(t, ["precio", "cuesta", "costo", "valor", "cuanto sale", "cuanto vale", "cuanto es", "cuanto piden", "cuanto el"])) {
    return out(`El precio es ${usd(p.price, p.operation)}${p.operation === "alquiler" ? "" : " (en dólares)"}. Si querés, un asesor puede darte más detalles de la operación.`);
  }
  if (has(t, ["dormitorio", "habitacion", "cuarto", "pieza"])) {
    return out(p.bedrooms ? `Tiene ${p.bedrooms} ${p.bedrooms === 1 ? "dormitorio" : "dormitorios"}.` : "Esta propiedad no tiene dormitorios (no corresponde a su tipo).");
  }
  if (has(t, ["bano"])) return out(p.bathrooms ? `Cuenta con ${p.bathrooms} ${p.bathrooms === 1 ? "baño" : "baños"}.` : "No tengo registrados baños para esta propiedad.");
  if (has(t, ["garage", "garaje", "cochera", "estacionamiento"])) return out(p.garage ? `Tiene ${p.garage} ${p.garage === 1 ? "cochera" : "cocheras"}.` : "No cuenta con cochera.");
  if (has(t, ["metro", "m2", "superficie", "tamano", "area", "grande"])) return out(p.area_m2 ? `La superficie es de ${p.area_m2} m².` : "No tengo la superficie cargada; un asesor te la confirma.", !p.area_m2);
  if (has(t, ["ubicacion", "barrio", "zona", "donde", "direccion", "queda"])) return out(`Está en ${where}. La dirección exacta se la damos al coordinar la visita.`);
  if (has(t, ["disponible", "sigue", "todavia"])) {
    return out(p.status === "disponible" ? "Sí, la propiedad está disponible." : `Por ahora figura como ${p.status}. Si querés, un asesor te avisa ante cualquier cambio.`, p.status !== "disponible");
  }
  if (has(t, ["hola", "buen", "consulta", "info"])) {
    return out(`¡Hola! Soy el asistente virtual. Puedo contarte sobre "${p.title}" (${p.operation}, ${usd(p.price, p.operation)}): ambientes, superficie, ubicación y más. ¿Qué te gustaría saber?`);
  }
  return out("No tengo ese dato a mano. Dejame tu nombre y un teléfono o email y un asesor te responde a la brevedad.", true);
}

// Respaldo sin IA cuando el visitante escribe a la inmobiliaria en general (sin propiedad concreta).
export function generalReply(agencyName, text) {
  const t = norm(text);
  const out = (reply, handoff = false) => ({ reply, handoff, source: "respaldo" });
  if (has(t, ["hola", "buen", "consulta", "info"]) && t.split(" ").length <= 4) {
    return out(`¡Hola! Soy el asistente virtual de ${agencyName}. Contame qué estás buscando (comprar o alquilar, zona, dormitorios, presupuesto) y te ayudo.`);
  }
  return out("Gracias por contarme. Dejame tu nombre y un teléfono o email y un asesor te envía opciones que se ajusten a lo que buscás.", true);
}

const PUBLIC_FIELDS = ["title", "operation", "type", "price", "bedrooms", "bathrooms", "garage", "area_m2", "country", "city", "neighborhood", "status", "description"];

// messages: [{ role: "user" | "assistant", text }]; el último es del visitante.
export async function askAssistant({ property = null, agency = null, businessName, messages }) {
  const last = messages[messages.length - 1]?.text ?? "";
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        business_name: businessName,
        agency: agency?.slug,
        ...(property ? { property: Object.fromEntries(PUBLIC_FIELDS.map((k) => [k, property[k]])) } : {}),
        messages: messages.slice(-12).map(({ role, text }) => ({ role, text })),
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (typeof data.reply !== "string" || !data.reply) throw new Error("respuesta vacía");
    return { reply: data.reply, handoff: !!data.handoff, source: "ia" };
  } catch {
    return property ? fallbackReply(property, last) : generalReply(businessName, last);
  }
}
