import assert from "node:assert/strict";
import { calcInstallment, whatsappLink } from "./quote.js";

// $10.000.000, 30% anticipo, 36 cuotas, TNA 60% → cuota ≈ 423.030
const q = calcInstallment({ price: 10_000_000, down: 3_000_000, months: 36, tna: 60 });
assert.equal(q.financed, 7_000_000);
assert.ok(Math.abs(q.monthly - 423_030) < 100, `cuota ${q.monthly}`);

// Tasa 0: cuotas iguales
const z = calcInstallment({ price: 1200, down: 0, months: 12, tna: 0 });
assert.equal(z.monthly, 100);

// Anticipo >= precio: nada que financiar
assert.equal(calcInstallment({ price: 100, down: 100, months: 12, tna: 50 }).monthly, 0);

assert.ok(whatsappLink("+54 9 11 1234-5678", "hola mundo").startsWith("https://wa.me/5491112345678?text=hola%20mundo"));
console.log("quote.js OK");
