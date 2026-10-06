// Genera la cotización en PDF en el navegador. jsPDF se carga recién al hacer clic.
import { money } from "./quote.js";

const JSPDF_URL = "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm";

async function loadImage(src) {
  if (!src) return null;
  try {
    const blob = await (await fetch(src)).blob();
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const { w, h } = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = reject;
      img.src = dataUrl;
    });
    return { dataUrl, w, h, format: /png/i.test(blob.type) ? "PNG" : "JPEG" };
  } catch {
    return null; // sin foto el PDF sale igual
  }
}

const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function downloadQuotePdf(v, settings, input, q) {
  const { jsPDF } = await import(JSPDF_URL);
  const photo = await loadImage(v.photos?.[0]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 18;

  // Encabezado
  doc.setFillColor(11, 15, 26);
  doc.rect(0, 0, W, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold").setFontSize(18).text(settings.business_name || "Automotora", M, 14);
  doc.setFont("helvetica", "normal").setFontSize(10)
    .text("Cotización de vehículo", M, 22)
    .text(new Date().toLocaleDateString("es-AR"), W - M, 22, { align: "right" });

  let y = 40;
  if (photo) {
    const maxW = W - 2 * M, maxH = 85;
    const ratio = Math.min(maxW / photo.w, maxH / photo.h);
    const w = photo.w * ratio, h = photo.h * ratio;
    doc.addImage(photo.dataUrl, photo.format, M + (maxW - w) / 2, y, w, h);
    y += h + 8;
  }

  doc.setTextColor(20, 24, 36);
  doc.setFont("helvetica", "bold").setFontSize(20).text(`${v.brand} ${v.model}`, M, y);
  y += 7;
  doc.setFont("helvetica", "normal").setFontSize(11).setTextColor(90, 98, 120)
    .text(`${v.year}  |  ${v.km.toLocaleString("es-AR")} km  |  ${v.fuel}  |  ${v.transmission}`, M, y);
  y += 12;

  const rows = [
    ["Precio de lista", money(v.price, v.currency)],
    ["Anticipo", money(input.down, v.currency)],
    ["Monto a financiar", money(q.financed, v.currency)],
    ["Plazo", `${input.months} cuotas`],
    ["TNA", `${input.tna}%`],
  ];
  doc.setFontSize(12);
  for (const [label, value] of rows) {
    doc.setTextColor(90, 98, 120).setFont("helvetica", "normal").text(label, M, y);
    doc.setTextColor(20, 24, 36).setFont("helvetica", "bold").text(value, W - M, y, { align: "right" });
    doc.setDrawColor(225, 228, 238).line(M, y + 2.5, W - M, y + 2.5);
    y += 9;
  }

  y += 4;
  doc.setFillColor(238, 242, 255).roundedRect(M, y, W - 2 * M, 28, 3, 3, "F");
  doc.setTextColor(90, 98, 120).setFont("helvetica", "normal").setFontSize(11).text("Cuota mensual estimada", M + 6, y + 9);
  doc.setTextColor(60, 90, 220).setFont("helvetica", "bold").setFontSize(22)
    .text(money(q.monthly, v.currency), M + 6, y + 21);
  doc.setTextColor(90, 98, 120).setFont("helvetica", "normal").setFontSize(10)
    .text(`Total a pagar: ${money(q.totalPaid, v.currency)}`, W - M - 6, y + 21, { align: "right" });
  y += 40;

  doc.setFontSize(9).setTextColor(120, 126, 145);
  const note = doc.splitTextToSize(
    "Cotización orientativa, sujeta a aprobación crediticia, disponibilidad del vehículo y variaciones de tasa. " +
      "No constituye una oferta vinculante.", W - 2 * M);
  doc.text(note, M, y);
  y += note.length * 4.5 + 6;

  if (settings.whatsapp) {
    doc.setFontSize(11).setTextColor(20, 24, 36).setFont("helvetica", "bold")
      .text(`Consultas por WhatsApp: +${String(settings.whatsapp).replace(/\D/g, "")}`, M, y);
  }

  doc.save(`cotizacion-${slug(`${v.brand} ${v.model} ${v.year}`)}.pdf`);
}
