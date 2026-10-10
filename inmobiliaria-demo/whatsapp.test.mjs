import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { Readable } from "node:stream";

const handler = createRequire(import.meta.url)("./api/whatsapp.js");

// ---------- utilidades de prueba ----------
const mkRes = () => {
  const res = { code: 200, headers: {}, body: null };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (c) => { res.code = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.send = (b) => { res.body = b; return res; };
  return res;
};
const SECRET = "app-secret";
const sign = (raw) => "sha256=" + crypto.createHmac("sha256", SECRET).update(raw).digest("hex");
const post = (payload, { signature, raw } = {}) => {
  const body = raw ?? JSON.stringify(payload);
  return Object.assign(Readable.from([Buffer.from(body)]), {
    method: "POST", headers: { host: "site.test", "x-hub-signature-256": signature ?? sign(body) },
  });
};
const incoming = (id, text, { phoneId = "PN1", from = "59899123456", type = "text", name = "Ana" } = {}) => ({
  entry: [{ changes: [{ value: {
    metadata: { phone_number_id: phoneId }, contacts: [{ wa_id: from, profile: { name } }],
    messages: [type === "text" ? { id, from, type, text: { body: text } } : { id, from, type }],
  } }] }],
});

// ---------- servicios simulados ----------
const db = { leads: [] };
const sent = [];
let claude = () => ({ ok: true, json: async () => ({ content: [{ type: "text", text: "Te recomiendo el Chalet frente al mar." }] }) });
let claudeCalls = 0;
let lastSystem = "";
const agencyRow = { id: "a1", slug: "costa-sur", name: "Costa Sur", city: "Punta del Este", country: "Uruguay", active: true };

globalThis.fetch = async (url, init = {}) => {
  url = String(url);
  const method = init.method || "GET";
  if (url.includes("api.anthropic.com")) {
    claudeCalls += 1;
    lastSystem = JSON.parse(init.body).system;
    return claude();
  }
  if (url.includes("graph.facebook.com")) {
    sent.push({ url, auth: init.headers.authorization, body: JSON.parse(init.body) });
    return { ok: true, json: async () => ({}) };
  }
  if (url.includes("/rest/v1/agency_whatsapp?")) {
    const known = url.includes("phone_number_id=eq.PN1");
    return { ok: true, json: async () => (known ? [{ agency_id: "a1", agencies: agencyRow }] : []) };
  }
  if (url.includes("/rest/v1/agencies?slug=")) return { ok: true, json: async () => [agencyRow] };
  if (url.includes("/rest/v1/properties?")) {
    return { ok: true, json: async () => [{ id: "p1", title: "Chalet frente al mar", operation: "venta", type: "casa", price: 640000, bedrooms: 5, bathrooms: 4, garage: 2, area_m2: 380, city: "Punta del Este", neighborhood: "Manantiales", status: "disponible", description: "x" }] };
  }
  if (url.includes("/rest/v1/leads")) {
    if (method === "GET") {
      const session = new URL(url).searchParams.get("session_id").replace("eq.", "");
      return { ok: true, json: async () => db.leads.filter((l) => l.session_id === session) };
    }
    const data = JSON.parse(init.body);
    if (method === "POST") db.leads.push({ id: `l${db.leads.length + 1}`, ...data });
    if (method === "PATCH") {
      const id = new URL(url).searchParams.get("id").replace("eq.", "");
      Object.assign(db.leads.find((l) => l.id === id), data);
    }
    return { ok: true, json: async () => null };
  }
  throw new Error(`fetch inesperado: ${method} ${url}`);
};

// ---------- verificación del webhook (GET) ----------
process.env.WHATSAPP_VERIFY_TOKEN = "mi-token";
let res = mkRes();
await handler({ method: "GET", headers: {}, query: { "hub.mode": "subscribe", "hub.verify_token": "mi-token", "hub.challenge": "12345" } }, res);
assert.deepEqual([res.code, res.body], [200, "12345"]);
res = mkRes();
await handler({ method: "GET", headers: {}, query: { "hub.mode": "subscribe", "hub.verify_token": "otro", "hub.challenge": "1" } }, res);
assert.equal(res.code, 403, "token de verificación incorrecto");
res = mkRes(); await handler({ method: "PUT", headers: {} }, res); assert.equal(res.code, 405);

// ---------- sin configuración o con firma inválida ----------
res = mkRes(); await handler(post(incoming("m0", "hola")), res); assert.equal(res.code, 503, "sin variables de entorno");
process.env.WHATSAPP_APP_SECRET = SECRET;
process.env.WHATSAPP_TOKEN = "wa-token";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
process.env.ANTHROPIC_API_KEY = "test-key";

res = mkRes(); await handler(post(incoming("m0", "hola"), { signature: "sha256=" + "0".repeat(64) }), res);
assert.equal(res.code, 403, "firma inválida");
res = mkRes(); await handler(post(incoming("m0", "hola"), { signature: "malformada" }), res);
assert.equal(res.code, 403, "firma malformada");
assert.equal(sent.length + claudeCalls, 0, "sin firma válida no se procesa nada");

// ---------- primer mensaje: crea la conversación y responde ----------
res = mkRes(); await handler(post(incoming("wamid.1", "busco una casa frente al mar")), res);
assert.equal(res.code, 200);
assert.deepEqual(res.body.results, ["ok"]);
assert.equal(sent.length, 1);
assert.equal(sent[0].body.to, "59899123456");
assert.equal(sent[0].body.text.body, "Te recomiendo el Chalet frente al mar.");
assert.equal(sent[0].auth, "Bearer wa-token");
assert.match(sent[0].url, /\/PN1\/messages$/);
assert.match(lastSystem, /WhatsApp/);
assert.ok(lastSystem.includes("https://site.test/property#p1"), "los links apuntan a la ficha");
assert.equal(db.leads.length, 1);
const lead = db.leads[0];
assert.deepEqual(
  [lead.agency_id, lead.kind, lead.channel, lead.name, lead.contact, lead.status, lead.messages.length],
  ["a1", "chat", "whatsapp", "Ana", "59899123456", "nuevo", 2]);

// ---------- segundo mensaje: misma conversación; pide visita => requiere atención ----------
claude = () => ({ ok: true, json: async () => ({ content: [{ type: "text", text: "¡Con gusto! Ya avisé al equipo. [[HUMANO]]" }] }) });
res = mkRes(); await handler(post(incoming("wamid.2", "quiero visitarla el sábado")), res);
assert.equal(db.leads.length, 1, "sigue siendo el mismo hilo");
assert.equal(db.leads[0].messages.length, 4);
assert.equal(db.leads[0].status, "atencion");
assert.equal(sent[1].body.text.body, "¡Con gusto! Ya avisé al equipo.", "el marcador interno no se envía");

// ---------- la atención pendiente es persistente ----------
claude = () => ({ ok: true, json: async () => ({ content: [{ type: "text", text: "Perfecto, gracias." }] }) });
res = mkRes(); await handler(post(incoming("wamid.3", "gracias")), res);
assert.equal(db.leads[0].status, "atencion", "sigue pendiente hasta que el equipo la marque como respondida");
assert.equal(db.leads[0].messages.length, 6);

// ---------- reentrega del mismo mensaje (Meta reintenta) ----------
const before = { sent: sent.length, claude: claudeCalls };
res = mkRes(); await handler(post(incoming("wamid.3", "gracias")), res);
assert.deepEqual(res.body.results, ["duplicate"]);
assert.deepEqual({ sent: sent.length, claude: claudeCalls }, before, "no responde dos veces");

// ---------- número no conectado, mensajes no de texto, avisos de estado ----------
res = mkRes(); await handler(post(incoming("wamid.9", "hola", { phoneId: "DESCONOCIDO" })), res);
assert.deepEqual(res.body.results, ["ignored"]);
assert.equal(sent.length, before.sent, "no responde desde números ajenos");

const claudeBefore = claudeCalls;
res = mkRes(); await handler(post(incoming("wamid.img", "", { type: "image", from: "59898000111", name: "Beto" })), res);
assert.deepEqual(res.body.results, ["ok"]);
assert.match(sent.at(-1).body.text.body, /solo puedo leer mensajes de texto/);
assert.equal(claudeCalls, claudeBefore, "un mensaje que no es texto no gasta IA");
assert.equal(db.leads.length, 2, "otro número => otra conversación");

res = mkRes(); await handler(post({ entry: [{ changes: [{ value: { statuses: [{ id: "x", status: "read" }] } }] }] }), res);
assert.deepEqual([res.code, res.body.results], [200, []]);

// ---------- si la IA falla: respuesta de cortesía y atención humana ----------
claude = () => ({ ok: false, status: 500, json: async () => ({}) });
res = mkRes(); await handler(post(incoming("wamid.fail", "hola", { from: "59898000222", name: "Cami" })), res);
assert.match(sent.at(-1).body.text.body, /asesor te responde/);
assert.equal(db.leads.at(-1).status, "atencion");

// ---------- utilidades ----------
const { uuidFrom, verifySignature } = handler;
assert.equal(uuidFrom("a1:123"), uuidFrom("a1:123"));
assert.notEqual(uuidFrom("a1:123"), uuidFrom("a2:123"));
assert.match(uuidFrom("x"), /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
assert.equal(verifySignature(Buffer.from("abc"), sign("abc"), SECRET), true);
assert.equal(verifySignature(Buffer.from("abd"), sign("abc"), SECRET), false);

console.log("whatsapp.test.mjs: ok");
