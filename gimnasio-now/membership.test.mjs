import assert from "node:assert/strict";
import {
  addDays, daysBetween, membershipStatus, newExpiry, normalizePhone, whatsappLink, openNow, todayStr, fmtDate,
} from "./membership.js";

// Fechas
assert.equal(addDays("2026-01-31", 1), "2026-02-01");
assert.equal(addDays("2026-12-31", 30), "2027-01-30");
assert.equal(daysBetween("2026-10-07", "2026-10-10"), 3);
assert.equal(daysBetween("2026-10-07", "2026-10-05"), -2);
assert.equal(fmtDate("2026-10-07"), "07/10/2026");

// Estado de cuota
const today = "2026-10-07";
assert.equal(membershipStatus(null, today), "sin-plan");
assert.equal(membershipStatus("2026-10-06", today), "vencida");
assert.equal(membershipStatus("2026-10-07", today), "por-vencer"); // vence hoy: todavía vigente
assert.equal(membershipStatus("2026-10-14", today), "por-vencer");
assert.equal(membershipStatus("2026-10-15", today), "al-dia");

// Un pago extiende desde el vencimiento si está vigente, desde hoy si venció
assert.equal(newExpiry("2026-10-20", today, 30), "2026-11-19");
assert.equal(newExpiry("2026-09-01", today, 30), "2026-11-06");
assert.equal(newExpiry(null, today, 30), "2026-11-06");
assert.equal(newExpiry("2026-10-07", today, 30), "2026-11-06"); // vence hoy: sigue vigente

// Teléfonos de Uruguay
assert.equal(normalizePhone("097 314 341"), "59897314341");
assert.equal(normalizePhone("+598 97 314 341"), "59897314341");
assert.equal(normalizePhone("97314341"), "59897314341");
assert.ok(whatsappLink("097314341", "hola mundo").startsWith("https://wa.me/59897314341?text=hola%20mundo"));

// Horarios (Montevideo = UTC-3)
const hours = [
  { days: [1, 2, 3, 4, 5], open: "08:30", close: "22:00" },
  { days: [6], open: "09:00", close: "13:00" },
];
assert.equal(openNow(hours, new Date("2026-10-05T15:00:00Z")), true);  // lunes 12:00
assert.equal(openNow(hours, new Date("2026-10-05T11:00:00Z")), false); // lunes 08:00, aún cerrado
assert.equal(openNow(hours, new Date("2026-10-06T01:30:00Z")), false); // lunes 22:30
assert.equal(openNow(hours, new Date("2026-10-10T14:00:00Z")), true);  // sábado 11:00
assert.equal(openNow(hours, new Date("2026-10-10T17:00:00Z")), false); // sábado 14:00
assert.equal(openNow(hours, new Date("2026-10-11T15:00:00Z")), false); // domingo

// "hoy" respeta la zona horaria: 02:00 UTC del 8/10 todavía es 7/10 en Montevideo
assert.equal(todayStr(new Date("2026-10-08T02:00:00Z")), "2026-10-07");

console.log("membership.js OK");
