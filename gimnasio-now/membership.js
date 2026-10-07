// Lógica pura de membresías (sin DOM ni red) para poder probarla con node.
// Las fechas de cuota son strings "YYYY-MM-DD" para evitar problemas de zona horaria.

const DAY = 864e5;
const toUtc = (s) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
const pad = (n) => String(n).padStart(2, "0");

export function todayStr(date = new Date(), tz = "America/Montevideo") {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(date).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

export function addDays(dateStr, n) {
  const d = new Date(toUtc(dateStr) + n * DAY);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// Días desde `from` hasta `to` (negativo si `to` ya pasó).
export const daysBetween = (from, to) => Math.round((toUtc(to) - toUtc(from)) / DAY);

export const fmtDate = (s) => (s ? s.split("-").reverse().join("/") : "—");

// "al-dia" | "por-vencer" (vence en <= soonDays) | "vencida" | "sin-plan"
export function membershipStatus(expiresOn, today, soonDays = 7) {
  if (!expiresOn) return "sin-plan";
  const left = daysBetween(today, expiresOn);
  if (left < 0) return "vencida";
  return left <= soonDays ? "por-vencer" : "al-dia";
}

export const STATUS_LABEL = { "al-dia": "Al día", "por-vencer": "Por vencer", vencida: "Vencida", "sin-plan": "Sin cuota" };

// Un pago extiende desde el vencimiento si sigue vigente; si ya venció, desde hoy.
export function newExpiry(currentExpiry, today, planDays) {
  const base = currentExpiry && currentExpiry >= today ? currentExpiry : today;
  return addDays(base, planDays);
}

export const money = (n) => "$ " + Math.round(n).toLocaleString("es-UY");

// Teléfonos de Uruguay: 097 314 341 → 59897314341.
export function normalizePhone(raw) {
  const d = String(raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("598")) return d;
  if (d.startsWith("0")) return "598" + d.slice(1);
  return "598" + d;
}

export const whatsappLink = (phone, text = "") =>
  `https://wa.me/${normalizePhone(phone)}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

export function reminderMessage(member, gymName, today) {
  const left = daysBetween(today, member.expires_on);
  const first = member.name.split(" ")[0];
  if (left < 0) return `Hola ${first}, te escribimos de ${gymName}. Tu cuota venció el ${fmtDate(member.expires_on)}. ¿Te esperamos esta semana para renovarla?`;
  if (left === 0) return `Hola ${first}, te escribimos de ${gymName}. Tu cuota vence hoy. ¡Te esperamos para renovarla!`;
  return `Hola ${first}, te escribimos de ${gymName}. Tu cuota vence el ${fmtDate(member.expires_on)} (en ${left} día${left === 1 ? "" : "s"}). ¡Te esperamos!`;
}

// hours: [{ days: [1..6 (0 = domingo)], open: "08:30", close: "22:00" }]
export function openNow(hours, date = new Date(), tz = "America/Montevideo") {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(date).map((x) => [x.type, x.value]));
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  const now = `${p.hour}:${p.minute}`;
  return hours.some((r) => r.days.includes(day) && now >= r.open && now < r.close);
}
