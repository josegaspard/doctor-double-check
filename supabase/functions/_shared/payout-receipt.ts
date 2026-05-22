// Genera el PDF del comprobante de pago a un doctor.
// Usado por process-doctor-payouts (pagos Stripe) para adjuntar siempre un
// comprobante al correo. Los pagos manuales usan el comprobante que sube el
// administrador.
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

export interface PayoutReceiptData {
  doctorName: string;
  amount: number;
  currency?: string;
  method: string; // "Stripe" | "Transferencia bancaria"
  reference?: string; // transfer id / referencia
  date: string; // fecha legible
  payoutId?: string;
}

export async function generatePayoutReceiptPdf(d: PayoutReceiptData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 440]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0.086, 0.227, 0.514);
  const teal = rgb(0, 0.463, 0.545);
  const gray = rgb(0.42, 0.42, 0.47);
  const ink = rgb(0.1, 0.1, 0.12);

  // Banda de encabezado
  page.drawRectangle({ x: 0, y: 380, width: 595, height: 60, color: navy });
  page.drawText("Medical Masters", { x: 40, y: 405, size: 20, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Comprobante de pago", { x: 40, y: 388, size: 10, font, color: rgb(0.8, 0.85, 0.95) });

  let y = 338;
  const row = (label: string, value: string) => {
    page.drawText(label, { x: 40, y, size: 11, font, color: gray });
    page.drawText(value, { x: 250, y, size: 11, font: bold, color: ink });
    y -= 30;
  };
  row("Beneficiario:", d.doctorName || "Doctor");
  row("Fecha:", d.date);
  row("Método de pago:", d.method);
  if (d.reference) row("Referencia:", d.reference);

  // Caja del monto
  page.drawRectangle({ x: 40, y: y - 34, width: 515, height: 56, color: rgb(0.93, 0.97, 0.97) });
  page.drawText("Monto pagado", { x: 58, y: y + 2, size: 10, font, color: gray });
  page.drawText(
    `$${d.amount.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${d.currency || "MXN"}`,
    { x: 58, y: y - 22, size: 19, font: bold, color: teal },
  );

  page.drawText(
    "Este comprobante certifica el pago de honorarios realizado por Medical Masters.",
    { x: 40, y: 48, size: 8, font, color: gray },
  );
  if (d.payoutId) {
    page.drawText(`ID de pago: ${d.payoutId}`, { x: 40, y: 34, size: 8, font, color: gray });
  }
  return await doc.save();
}
