import assert from "node:assert/strict";
import { usd, whatsappLink, filterProperties, sortProperties, place } from "./format.js";

assert.equal(usd(185000), "US$ 185,000");
assert.equal(usd(850, "alquiler"), "US$ 850/mes");
assert.equal(usd(99.6), "US$ 100");

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
assert.equal(filterProperties(list, { q: "uruguay", operation: "venta", max: 100000 })[0].title, "Terreno");

assert.deepEqual(sortProperties(list, "price-asc").map((p) => p.price), [600, 80000, 300000]);
assert.equal(sortProperties(list, "new")[0].title, "Apto Centro");
assert.equal(sortProperties(list, "area-desc")[0].title, "Terreno");

assert.equal(place(list[2]), "Punta del Este, Uruguay");
console.log("format.test.mjs: ok");
