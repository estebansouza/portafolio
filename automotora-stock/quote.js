// Lógica pura del cotizador (sistema francés) y mensajes de WhatsApp.

export function calcInstallment({ price, down = 0, months, tna = 0 }) {
  const financed = Math.max(price - down, 0);
  const r = tna / 100 / 12;
  let monthly;
  if (financed === 0 || months <= 0) monthly = 0;
  else if (r === 0) monthly = financed / months;
  else monthly = (financed * r) / (1 - Math.pow(1 + r, -months));
  const totalPaid = down + monthly * months;
  return { financed, monthly, totalPaid, interest: totalPaid - price };
}

export function money(n, currency = "ARS") {
  const symbol = currency === "USD" ? "US$" : "$";
  return `${symbol} ${Math.round(n).toLocaleString("es-AR")}`;
}

export function whatsappLink(phone, text) {
  return `https://wa.me/${String(phone).replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

export function inquiryMessage(v, url) {
  return `Hola! Me interesa el ${v.brand} ${v.model} ${v.year}. ${url}`;
}

export function quoteMessage(v, q, { down, months, tna }, url) {
  return [
    `Hola! Quiero consultar la financiación del ${v.brand} ${v.model} ${v.year}.`,
    `Precio: ${money(v.price, v.currency)}`,
    `Anticipo: ${money(down, v.currency)}`,
    `${months} cuotas de ${money(q.monthly, v.currency)} (TNA ${tna}%)`,
    url,
  ].join("\n");
}
