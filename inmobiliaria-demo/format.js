// Lógica pura: formato de precios, filtros, orden y mensajes de WhatsApp.

export const TYPES = ["casa", "apartamento", "terreno", "local"];
export const OPERATIONS = ["venta", "alquiler"];
export const STATUSES = ["disponible", "reservada", "cerrada"];

// Cada propiedad tiene su moneda (USD por defecto). En alquiler el monto es por mes.
export const CURRENCIES = {
  USD: "US$ (dólares)",
  UYU: "$ (pesos uruguayos)",
  ARS: "ARS (pesos argentinos)",
  BRL: "BRL (reales)",
  EUR: "EUR (euros)",
  CLP: "CLP (pesos chilenos)",
  COP: "COP (pesos colombianos)",
  MXN: "MXN (pesos mexicanos)",
  PEN: "PEN (soles)",
};
export const currencyOf = (p) => (p && p.currency in CURRENCIES ? p.currency : "USD");

export function money(n, operation = "venta", currency = "USD") {
  const cur = currency in CURRENCIES ? currency : "USD";
  const s = new Intl.NumberFormat("es-UY", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(Math.round(n));
  return operation === "alquiler" ? `${s}/mes` : s;
}
export const usd = (n, operation = "venta") => money(n, operation, "USD");
// Precio de una propiedad con su propia moneda.
export const priceOf = (p) => money(p.price, p.operation, currencyOf(p));

export function whatsappLink(phone, text) {
  return `https://wa.me/${String(phone).replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

export function inquiryMessage(p, url) {
  return `Hola! Me interesa la propiedad "${p.title}" (${p.operation}, ${priceOf(p)}). ${url}`;
}

export const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// filters: { operation, type, bedrooms (mínimo), max (precio tope), currency (si se indica, solo esa moneda), q (texto) }
// Con varias monedas el tope solo tiene sentido dentro de una: quien llama debe pasar currency.
export function filterProperties(list, f = {}) {
  const q = norm(f.q).trim();
  const bedrooms = Number(f.bedrooms) || 0;
  const max = Number(f.max) || Infinity;
  return list.filter((p) =>
    (!f.operation || p.operation === f.operation) &&
    (!f.type || p.type === f.type) &&
    (!f.currency || currencyOf(p) === f.currency) &&
    (p.bedrooms ?? 0) >= bedrooms &&
    p.price <= max &&
    (!q || norm(`${p.title} ${p.city} ${p.neighborhood} ${p.country}`).includes(q)));
}

const SORTS = {
  new: (a, b) => b.created_at.localeCompare(a.created_at),
  "price-asc": (a, b) => a.price - b.price,
  "price-desc": (a, b) => b.price - a.price,
  "area-desc": (a, b) => (b.area_m2 ?? 0) - (a.area_m2 ?? 0),
};

export function sortProperties(list, sort = "new") {
  return [...list].sort(SORTS[sort] ?? SORTS.new);
}

export const place = (p) => [p.neighborhood, p.city, p.country].filter(Boolean).join(", ");
