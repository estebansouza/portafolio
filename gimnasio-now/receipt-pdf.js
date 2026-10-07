// Comprobante de pago en PDF, generado en el navegador. jsPDF se carga recién al hacer clic.
import { GYM } from "./config.js";
import { money, fmtDate, normalizePhone } from "./membership.js";

const JSPDF_URL = "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/+esm";

const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function downloadReceiptPdf(member, payment) {
  const { jsPDF } = await import(JSPDF_URL);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 18;

  doc.setFillColor(29, 31, 33);
  doc.rect(0, 0, W, 32, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold").setFontSize(20).text("NOW ", M, 16);
  doc.setTextColor(238, 44, 60).text("FITNESS", M + doc.getTextWidth("NOW "), 16);
  doc.setTextColor(255, 255, 255).setFont("helvetica", "normal").setFontSize(10)
    .text("Comprobante de pago", M, 25)
    .text(fmtDate(payment.paid_on), W - M, 25, { align: "right" });

  let y = 48;
  doc.setTextColor(20, 24, 36).setFont("helvetica", "bold").setFontSize(18).text(member.name, M, y);
  y += 7;
  if (member.document) {
    doc.setFont("helvetica", "normal").setFontSize(11).setTextColor(90, 98, 120).text(`Documento: ${member.document}`, M, y);
    y += 6;
  }
  y += 8;

  const rows = [
    ["Plan", payment.plan_name],
    ["Período cubierto", `${fmtDate(payment.covers_from)} al ${fmtDate(payment.expires_on)}`],
    ["Medio de pago", payment.method],
    ["Fecha de pago", fmtDate(payment.paid_on)],
  ];
  doc.setFontSize(12);
  for (const [label, value] of rows) {
    doc.setTextColor(90, 98, 120).setFont("helvetica", "normal").text(label, M, y);
    doc.setTextColor(20, 24, 36).setFont("helvetica", "bold").text(String(value), W - M, y, { align: "right" });
    doc.setDrawColor(225, 228, 238).line(M, y + 2.5, W - M, y + 2.5);
    y += 9;
  }

  y += 4;
  doc.setFillColor(250, 235, 237).roundedRect(M, y, W - 2 * M, 26, 3, 3, "F");
  doc.setTextColor(90, 98, 120).setFont("helvetica", "normal").setFontSize(11).text("Total abonado", M + 6, y + 10);
  doc.setTextColor(190, 24, 40).setFont("helvetica", "bold").setFontSize(22).text(money(payment.amount), M + 6, y + 21);
  doc.setTextColor(90, 98, 120).setFont("helvetica", "normal").setFontSize(10)
    .text(`Vence el ${fmtDate(payment.expires_on)}`, W - M - 6, y + 21, { align: "right" });
  y += 40;

  doc.setFontSize(10).setTextColor(90, 98, 120)
    .text(`${GYM.name} · ${GYM.address}, ${GYM.city}`, M, y)
    .text(`WhatsApp: +${normalizePhone(GYM.whatsapp)}`, M, y + 5);
  doc.setFontSize(8).setTextColor(150, 154, 170)
    .text("Comprobante interno de pago de cuota. No es una factura.", M, y + 14);

  doc.save(`comprobante-${slug(member.name)}-${payment.paid_on}.pdf`);
}
