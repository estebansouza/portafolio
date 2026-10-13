import assert from "node:assert/strict";
import { usd, money, priceOf, currencyOf, whatsappLink, filterProperties, sortProperties, place } from "./format.js";

// Los precios usan formato es-UY; el espacio entre símbolo y número es un espacio fijo (no se parte la línea).
const flat = (s) => s.replace(/ /g, " ");
assert.equal(flat(usd(185000)), "US$ 185.000");
assert.equal(flat(usd(850, "alquiler")), "US$ 850/mes");
assert.equal(flat(usd(99.6)), "US$ 100");
assert.equal(flat(money(19300, "alquiler", "UYU")), "$ 19.300/mes", "pesos uruguayos como en las webs locales");
assert.equal(flat(money(38000, "venta", "UYU")), "$ 38.000");
assert.equal(flat(money(1500, "venta", "EUR")), "EUR 1.500");
assert.equal(flat(money(500, "venta", "XXX")), "US$ 500", "moneda desconocida: dólares");
assert.equal(currencyOf({}), "USD");
assert.equal(currencyOf({ currency: "UYU" }), "UYU");
assert.equal(flat(priceOf({ price: 14000, operation: "alquiler", currency: "UYU" })), "$ 14.000/mes");
assert.equal(flat(priceOf({ price: 30000, operation: "venta" })), "US$ 30.000");

assert.equal(whatsappLink("+598 97 123 456", "Hola a b"), "https://wa.me/59897123456?text=Hola%20a%20b");

const list = [
  { title: "Casa Pocitos", operation: "venta", type: "casa", bedrooms: 3, price: 300000, city: "Montevideo", neighborhood: "Pocitos", country: "Uruguay", created_at: "2026-01-02", area_m2: 200 },
  { title: "Apto Centro", operation: "alquiler", type: "apartamento", bedrooms: 1, price: 600, city: "Bogotá", neighborhood: "Chapinero", country: "Colombia", created_at: "2026-01-03", area_m2: 45 },
  { title: "Terreno", operation: "venta", type: "terreno", bedrooms: 0, price: 80000, city: "Punta del Este", neighborhood: "", country: "Uruguay", created_at: "2026-01-01", area_m2: 900 },
];

assert.equal(filterProperties(list, { operation: "venta" }).length, 2);
assert.equal(filterProperties(list, { type: "casa" }).length, 1);
assert.equal(filterProperties(list, { bedrooms: 2 }).length, 1);
assert.equal(filterProperties(list, { max: 100000 }).length, 2);
assert.equal(filterProperties(list, { q: "bogota" }).length, 1, "búsqueda sin tildes");
const mixed = [
  { title: "A", operation: "alquiler", type: "casa", bedrooms: 1, price: 19300, currency: "UYU", created_at: "2026-01-01" },
  { title: "B", operation: "venta", type: "casa", bedrooms: 2, price: 38000, currency: "USD", created_at: "2026-01-02" },
  { title: "C", operation: "venta", type: "local", bedrooms: 0, price: 30000, created_at: "2026-01-03" },
];
assert.deepEqual(filterProperties(mixed, { currency: "USD" }).map((p) => p.title), ["B", "C"], "sin moneda se considera USD");
assert.deepEqual(filterProperties(mixed, { currency: "UYU", max: 20000 }).map((p) => p.title), ["A"]);
assert.deepEqual(filterProperties(mixed, { currency: "USD", max: 35000 }).map((p) => p.title), ["C"], "el tope solo mide dentro de esa moneda");
assert.equal(filterProperties(list, { q: "uruguay", operation: "venta", max: 100000 })[0].title, "Terreno");

assert.deepEqual(sortProperties(list, "price-asc").map((p) => p.price), [600, 80000, 300000]);
assert.equal(sortProperties(list, "new")[0].title, "Apto Centro");
assert.equal(sortProperties(list, "area-desc")[0].title, "Terreno");

assert.equal(place(list[2]), "Punta del Este, Uruguay");
console.log("format.test.mjs: ok");
