// Lógica pura: formato de precios en USD, filtros, orden y mensajes de WhatsApp.

export const TYPES = ["casa", "apartamento", "terreno", "local"];
export const OPERATIONS = ["venta", "alquiler"];
export const STATUSES = ["disponible", "reservada", "cerrada"];

// Todos los precios están en dólares; en alquiler el monto es por mes.
export function usd(n, operation = "venta") {
  const s = `US$ ${Math.round(n).toLocaleString("en-US")}`;
  return operation === "alquiler" ? `${s}/mes` : s;
}

export function whatsappLink(phone, text) {
  return `https://wa.me/${String(phone).replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

export function inquiryMessage(p, url) {
  return `Hola! Me interesa la propiedad "${p.title}" (${p.operation}, ${usd(p.price, p.operation)}). ${url}`;
}

const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// filters: { operation, type, bedrooms (mínimo), max (USD), q (texto) }
export function filterProperties(list, f = {}) {
  const q = norm(f.q).trim();
  const bedrooms = Number(f.bedrooms) || 0;
  const max = Number(f.max) || Infinity;
  return list.filter((p) =>
    (!f.operation || p.operation === f.operation) &&
    (!f.type || p.type === f.type) &&
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
