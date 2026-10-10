// Función serverless de Vercel: responde consultas del chat web con Claude.
// Variables de entorno: ANTHROPIC_API_KEY (obligatoria), ANTHROPIC_MODEL (opcional).
// Sin API key responde 503 y el sitio usa sus respuestas de respaldo.
const { SLUG_RE, cleanProperty, cleanMessages, loadCatalog, agencyPrompt, systemPrompt, askClaude } = require("./_lib/ai.js");

// Límite simple por IP (por instancia; es una protección básica contra abuso de costo).
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 30;
}

async function handler(req, res) {
  res.setHeader("cache-control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  const origin = req.headers.origin;
  if (origin) {
    let host = "";
    try { host = new URL(origin).host; } catch { /* origen inválido */ }
    if (host !== req.headers.host) return res.status(403).json({ error: "forbidden" });
  }

  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: "no_key" });

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (limited(ip)) return res.status(429).json({ error: "rate_limited" });

  const body = typeof req.body === "string" ? safeJson(req.body) : req.body || {};
  const messages = cleanMessages(body.messages);
  if (!messages.length || messages[messages.length - 1].role !== "user") return res.status(400).json({ error: "bad_request" });

  const slug = typeof body.agency === "string" ? body.agency.toLowerCase() : "";
  let system;
  if (body.property) {
    system = systemPrompt(body.business_name, cleanProperty(body.property));
  } else if (SLUG_RE.test(slug)) {
    try {
      const cat = await loadCatalog(slug);
      if (!cat) return res.status(404).json({ error: "agency_not_found" });
      const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0];
      system = agencyPrompt(cat.agency, cat.props, `${proto}://${req.headers.host}`);
    } catch {
      return res.status(502).json({ error: "catalog" });
    }
  } else {
    return res.status(400).json({ error: "bad_request" });
  }

  try {
    return res.status(200).json(await askClaude({ system, messages }));
  } catch (e) {
    return res.status(502).json({ error: e.code || "upstream", ...(e.status ? { status: e.status } : {}) });
  }
}

function safeJson(s) { try { return JSON.parse(s); } catch { return {}; } }

module.exports = handler;
module.exports.cleanMessages = cleanMessages;
module.exports.cleanProperty = cleanProperty;
module.exports.systemPrompt = systemPrompt;
module.exports.agencyPrompt = agencyPrompt;
