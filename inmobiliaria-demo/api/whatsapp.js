// Webhook de WhatsApp Business (Meta Cloud API): responde automáticamente con la misma IA del chat web.
// Meta llama a este endpoint (GET para verificarlo, POST con cada mensaje entrante).
//
// Variables de entorno (Vercel):
//   WHATSAPP_VERIFY_TOKEN       texto que elegís y pegás también en la configuración del webhook de Meta
//   WHATSAPP_APP_SECRET         "App secret" de la app de Meta (valida que el aviso viene de Meta)
//   WHATSAPP_TOKEN              token de acceso (usuario del sistema) con permiso whatsapp_business_messaging
//   SUPABASE_SERVICE_ROLE_KEY   clave de servicio de Supabase (guarda las conversaciones sin pasar por RLS)
//   ANTHROPIC_API_KEY           la misma del chat web
//   WHATSAPP_GRAPH_VERSION      opcional (por defecto v23.0)    PUBLIC_BASE_URL  opcional (links a las fichas)
const crypto = require("node:crypto");
const { loadCatalog, agencyPrompt, cleanMessages, askClaude, str } = require("./_lib/ai.js");

const SB_URL = process.env.SUPABASE_URL || "https://dvlktbslrsdwxjnktkfb.supabase.co";
const GRAPH = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
const MAX_BODY = 1024 * 1024;

// ---------- utilidades ----------
async function readRaw(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    const b = Buffer.from(c);
    size += b.length;
    if (size > MAX_BODY) throw new Error("body_too_large");
    chunks.push(b);
  }
  return Buffer.concat(chunks);
}

// Meta firma el cuerpo crudo con HMAC-SHA256 y la app secret: "sha256=<hex>" en X-Hub-Signature-256.
function verifySignature(raw, header, secret) {
  if (typeof header !== "string" || !header.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const given = header.slice(7);
  return given.length === expected.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

// Un uuid estable por (inmobiliaria, número): todas las conversaciones de esa persona van al mismo hilo.
function uuidFrom(s) {
  const b = crypto.createHash("sha256").update(s).digest().subarray(0, 16);
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// Base de datos con la clave de servicio (solo en el servidor).
async function sbs(path, init = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json", prefer: "return=minimal", ...init.headers },
  });
  if (!r.ok) throw new Error(`supabase ${r.status}`);
  return init.method && init.method !== "GET" ? null : r.json();
}

async function sendText(phoneId, to, body) {
  const r = await fetch(`https://graph.facebook.com/${GRAPH}/${phoneId}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { preview_url: true, body: String(body).slice(0, 4000) } }),
  });
  if (!r.ok) throw new Error(`whatsapp ${r.status}`);
}

// Límite por número (por instancia): evita que una persona (o un bot) dispare costos de IA.
const hits = new Map();
function tooMany(waId) {
  const now = Date.now();
  const recent = (hits.get(waId) || []).filter((t) => now - t < 10 * 60 * 1000);
  recent.push(now);
  hits.set(waId, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 30;
}

// ---------- un mensaje entrante ----------
async function handleMessage({ phoneId, msg, profileName, baseUrl }) {
  const [wa] = await sbs(`agency_whatsapp?phone_number_id=eq.${encodeURIComponent(phoneId)}&select=agency_id,agencies(id,slug,name,city,country,active)`);
  const agency = wa?.agencies;
  if (!agency?.active) return "ignored"; // número que no está conectado a ninguna inmobiliaria

  const waId = String(msg.from ?? "").replace(/\D/g, "");
  if (!waId) return "ignored";
  const session = uuidFrom(`${agency.id}:${waId}`);
  const [lead] = await sbs(`leads?session_id=eq.${session}&select=id,name,messages,status`);
  const existing = Array.isArray(lead?.messages) ? lead.messages : [];
  if (msg.id && existing.some((m) => m.id === msg.id)) return "duplicate"; // Meta reintenta entregas
  if (tooMany(waId)) return "rate_limited";

  const text = msg.type === "text" ? str(msg.text?.body, 1000).trim() : "";
  const userMsg = { role: "user", text: text || "[mensaje que no es de texto]", at: new Date().toISOString(), id: msg.id };

  let reply;
  let handoff = false;
  if (!text) {
    reply = "Por ahora solo puedo leer mensajes de texto. ¿Me contás por escrito qué estás buscando?";
  } else {
    try {
      const cat = await loadCatalog(agency.slug);
      const system = agencyPrompt(cat?.agency ?? agency, cat?.props ?? [], baseUrl, { channel: "whatsapp" });
      ({ reply, handoff } = await askClaude({ system, messages: cleanMessages([...existing, userMsg]) }));
    } catch (e) {
      console.error("[whatsapp] IA no disponible:", e.message);
      reply = "¡Gracias por escribirnos! Un asesor te responde a la brevedad.";
      handoff = true;
    }
  }

  let sendFailed = false;
  try { await sendText(phoneId, waId, reply); } catch (e) { sendFailed = true; console.error("[whatsapp] no se pudo enviar:", e.message); }

  // Una vez que pidió atención sigue pendiente hasta que el equipo la marque como respondida.
  const status = handoff || sendFailed || lead?.status === "atencion" ? "atencion" : "nuevo";
  const messages = [...existing, userMsg, { role: "assistant", text: reply, at: new Date().toISOString() }].slice(-60);
  if (lead) {
    await sbs(`leads?id=eq.${lead.id}`, { method: "PATCH", body: JSON.stringify({ messages, status, contact: waId, name: lead.name || str(profileName, 80) }) });
  } else {
    await sbs("leads", { method: "POST", body: JSON.stringify({
      agency_id: agency.id, session_id: session, kind: "chat", channel: "whatsapp", property_label: "Consulta por WhatsApp",
      name: str(profileName, 80), contact: waId, message: userMsg.text, messages, status,
    }) });
  }
  return sendFailed ? "send_failed" : "ok";
}

// ---------- endpoint ----------
async function handler(req, res) {
  res.setHeader("cache-control", "no-store");

  // Verificación inicial del webhook (Meta llama una vez al configurarlo).
  if (req.method === "GET") {
    const q = req.query || {};
    const expected = process.env.WHATSAPP_VERIFY_TOKEN;
    if (expected && q["hub.mode"] === "subscribe" && q["hub.verify_token"] === expected) {
      return res.status(200).send(String(q["hub.challenge"] ?? ""));
    }
    return res.status(403).json({ error: "forbidden" });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  if (!process.env.WHATSAPP_APP_SECRET || !process.env.WHATSAPP_TOKEN || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: "not_configured" });
  }

  let raw;
  try { raw = await readRaw(req); } catch { return res.status(413).json({ error: "too_large" }); }
  if (!verifySignature(raw, req.headers["x-hub-signature-256"], process.env.WHATSAPP_APP_SECRET)) {
    return res.status(403).json({ error: "bad_signature" });
  }

  let payload;
  try { payload = JSON.parse(raw.toString("utf8")); } catch { return res.status(400).json({ error: "bad_json" }); }

  const baseUrl = process.env.PUBLIC_BASE_URL || `https://${req.headers.host}`;
  const results = [];
  try {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const v = change.value;
        if (!v?.messages?.length) continue; // avisos de estado (entregado/leído) y otros
        const names = Object.fromEntries((v.contacts ?? []).map((c) => [c.wa_id, c.profile?.name]));
        for (const msg of v.messages) {
          results.push(await handleMessage({ phoneId: v.metadata?.phone_number_id, msg, profileName: names[msg.from], baseUrl }));
        }
      }
    }
  } catch (e) {
    console.error("[whatsapp] error:", e.message);
    return res.status(500).json({ error: "internal" }); // Meta reintenta; los duplicados se descartan por id
  }
  return res.status(200).json({ ok: true, results });
}

module.exports = handler;
module.exports.config = { api: { bodyParser: false } };
module.exports.verifySignature = verifySignature;
module.exports.uuidFrom = uuidFrom;
