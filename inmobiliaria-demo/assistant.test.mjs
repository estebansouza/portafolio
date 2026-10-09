import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fallbackReply, askAssistant } from "./assistant.js";

const p = { title: "Casa con jardín", operation: "venta", type: "casa", price: 285000, bedrooms: 3, bathrooms: 2, garage: 0, area_m2: 210, city: "Montevideo", neighborhood: "Carrasco", country: "Uruguay", status: "disponible", description: "x" };

// ---- respaldo sin IA ----
assert.match(fallbackReply(p, "¿Cuánto cuesta?").reply, /US\$ 285,000/);
assert.equal(fallbackReply(p, "Cuanto sale").handoff, false);
assert.match(fallbackReply(p, "¿Cuántos dormitorios tiene?").reply, /3 dormitorios/);
assert.match(fallbackReply(p, "tiene cochera?").reply, /No cuenta con cochera/);
assert.match(fallbackReply(p, "¿Dónde queda?").reply, /Carrasco, Montevideo, Uruguay/);
const visit = fallbackReply(p, "Quisiera agendar una visita el sábado");
assert.equal(visit.handoff, true);
assert.equal(fallbackReply(p, "¿Aceptan ofertas? quiero negociar").handoff, true);
const unknown = fallbackReply(p, "¿cuánto son las expensas del consorcio?");
assert.equal(unknown.source, "respaldo");
assert.equal(fallbackReply(p, "tienen piscina climatizada?").handoff, true);
assert.equal(fallbackReply({ ...p, status: "reservada" }, "sigue disponible?").handoff, true);

// ---- askAssistant: usa IA si el servidor responde y respaldo si falla ----
globalThis.fetch = async () => ({ ok: true, json: async () => ({ reply: "Hola desde la IA", handoff: true }) });
let r = await askAssistant({ property: p, businessName: "X", messages: [{ role: "user", text: "hola" }] });
assert.deepEqual(r, { reply: "Hola desde la IA", handoff: true, source: "ia" });
globalThis.fetch = async () => ({ ok: false, status: 503 });
r = await askAssistant({ property: p, businessName: "X", messages: [{ role: "user", text: "cuanto cuesta" }] });
assert.equal(r.source, "respaldo");
globalThis.fetch = async () => { throw new Error("offline"); };
r = await askAssistant({ property: p, businessName: "X", messages: [{ role: "user", text: "cuanto cuesta" }] });
assert.equal(r.source, "respaldo");

// ---- función serverless (api/chat.js) con Anthropic simulado ----
const handler = createRequire(import.meta.url)("./api/chat.js");
const mkRes = () => {
  const res = { code: 200, headers: {}, body: null };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (c) => { res.code = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
};
const req = (over = {}) => ({
  method: "POST", headers: { host: "site.test", origin: "https://site.test", "x-forwarded-for": "1.1.1.1" },
  body: { business_name: "Nexo", property: p, messages: [{ role: "user", text: "quiero visitar" }] }, ...over,
});

let res = mkRes(); await handler(req({ method: "GET" }), res); assert.equal(res.code, 405);
res = mkRes(); await handler(req({ headers: { host: "site.test", origin: "https://evil.test" } }), res); assert.equal(res.code, 403);
delete process.env.ANTHROPIC_API_KEY;
res = mkRes(); await handler(req(), res); assert.equal(res.code, 503, "sin key responde 503");

process.env.ANTHROPIC_API_KEY = "test-key";
let sent;
globalThis.fetch = async (url, init) => {
  sent = { url, init, body: JSON.parse(init.body) };
  return { ok: true, json: async () => ({ content: [{ type: "text", text: "Claro, ¿me dejás tu contacto? [[HUMANO]]" }] }) };
};
res = mkRes(); await handler(req(), res);
assert.equal(res.code, 200);
assert.deepEqual(res.body, { reply: "Claro, ¿me dejás tu contacto?", handoff: true });
assert.equal(sent.url, "https://api.anthropic.com/v1/messages");
assert.equal(sent.init.headers["x-api-key"], "test-key");
assert.match(sent.body.system, /Casa con jardín/);
assert.equal(sent.body.messages[0].role, "user");

res = mkRes(); await handler(req({ body: { messages: [{ role: "assistant", text: "hola" }] } }), res);
assert.equal(res.code, 400, "el último mensaje debe ser del visitante");
assert.deepEqual(handler.cleanMessages([{ role: "assistant", text: "a" }, { role: "user", text: "b" }, { role: "system", text: "x" }]), [{ role: "user", content: "b" }]);

globalThis.fetch = async () => ({ ok: false, status: 500 });
res = mkRes(); await handler(req({ headers: { host: "site.test", "x-forwarded-for": "2.2.2.2" } }), res);
assert.equal(res.code, 502);

console.log("assistant.test.mjs: ok");
