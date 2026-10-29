import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { brand } from "@/config/brand";
import { formatDay, formatSlot, formatTime } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { LOGO_PNG_BASE64 } from "@/lib/receipt/logo";

/** Données d'un reçu : uniquement ce qui a été réellement payé (les produits). */
export interface ReceiptData {
  reference: string;
  createdAt: string;
  paidAt: string | null;
  /** null quand le nom ne doit pas apparaître (lien de suivi ouvert hors du navigateur d'origine). */
  customerName: string | null;
  fulfillment: "pickup" | "delivery";
  slot: { startsAt: string; endsAt: string } | null;
  items: { productName: string; variantLabel: string; flavorName: string | null; quantity: number; lineTotalFcfa: number }[];
  totalFcfa: number;
  paymentLabel: string | null;
  paymentReference: string | null;
}

export function receiptFilename(reference: string): string {
  return `recu-${reference.replace(/[^A-Za-z0-9-]/g, "")}.pdf`;
}

const CHOCOLAT = rgb(0.29, 0.17, 0.11);
const DOUX = rgb(0.45, 0.36, 0.31);
const CARAMEL = rgb(0.6, 0.36, 0.13);

/**
 * Les polices standard du PDF ne couvrent que l'alphabet latin courant : espaces fines
 * remplacées, caractères inconnus retirés plutôt que de faire échouer le document.
 */
function sanitizer(font: PDFFont) {
  const supported = new Set(font.getCharacterSet());
  return (text: string) =>
    Array.from(text.replace(/[   ]/g, " "))
      .filter((ch) => supported.has(ch.codePointAt(0)!))
      .join("");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !line) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Reçu A5 portrait : logo, coordonnées, détail des produits, total payé, mode de remise. */
export async function buildReceiptPdf(data: ReceiptData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Reçu ${data.reference}`);
  pdf.setAuthor(brand.name);
  pdf.setSubject(`Reçu de la commande ${data.reference}`);
  pdf.setCreator(brand.name);

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const clean = sanitizer(regular);
  const logo = await pdf.embedPng(Uint8Array.from(Buffer.from(LOGO_PNG_BASE64, "base64")));

  const width = 420;
  const height = 595;
  const margin = 36;
  let page: PDFPage = pdf.addPage([width, height]);
  let y = height - margin;

  const ensure = (needed: number) => {
    if (y - needed < margin) {
      page = pdf.addPage([width, height]);
      y = height - margin;
    }
  };
  const text = (value: string, options: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; align?: "left" | "center" | "right"; x?: number } = {}) => {
    const size = options.size ?? 10;
    const font = options.font ?? regular;
    const content = clean(value);
    const w = font.widthOfTextAtSize(content, size);
    const x = options.align === "center" ? (width - w) / 2 : options.align === "right" ? width - margin - w : (options.x ?? margin);
    page.drawText(content, { x, y, size, font, color: options.color ?? CHOCOLAT });
  };
  const rule = () => {
    ensure(12);
    y -= 6;
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.6, color: DOUX, dashArray: [3, 3] });
    y -= 14;
  };

  // En-tête : logo et coordonnées
  const logoSize = 78;
  page.drawImage(logo, { x: (width - logoSize) / 2, y: y - logoSize, width: logoSize, height: logoSize });
  y -= logoSize + 18;
  text(brand.name, { size: 18, font: bold, align: "center" });
  y -= 14;
  text(`Pâtisseries faites maison à ${brand.city}`, { size: 9, color: DOUX, align: "center" });
  y -= 12;
  text(`${brand.pickupAddress}, ${brand.city} · ${brand.phoneDisplay}`, { size: 9, color: DOUX, align: "center" });
  y -= 12;
  text("Activité individuelle de pâtisserie maison, en cours de formalisation", { size: 8.5, color: DOUX, align: "center" });
  y -= 6;
  rule();

  // Identité du reçu
  text("Reçu de commande", { size: 9, color: CARAMEL, font: bold });
  y -= 16;
  text(data.reference, { size: 16, font: bold });
  y -= 16;
  text(`Commande du ${formatDay(data.createdAt)}, ${formatTime(data.createdAt)}`, { size: 9.5 });
  y -= 13;
  if (data.paidAt) {
    text(`Payée le ${formatDay(data.paidAt)}, ${formatTime(data.paidAt)}`, { size: 9.5 });
    y -= 13;
  }
  if (data.customerName) {
    text(`Client : ${data.customerName}`, { size: 9.5 });
    y -= 13;
  }
  if (data.slot) {
    const mode = data.fulfillment === "pickup" ? "Retrait" : "Livraison";
    for (const line of wrap(clean(`${mode} : ${formatSlot(data.slot.startsAt, data.slot.endsAt)}`), regular, 9.5, width - margin * 2)) {
      text(line, { size: 9.5 });
      y -= 13;
    }
  }
  rule();

  // Détail des produits
  const amountColumn = 92;
  for (const item of data.items) {
    const label = `${item.quantity} × ${item.productName} — ${item.variantLabel}${item.flavorName ? ` (${item.flavorName})` : ""}`;
    const lines = wrap(clean(label), regular, 10, width - margin * 2 - amountColumn);
    ensure(lines.length * 13 + 4);
    text(formatFcfa(item.lineTotalFcfa), { size: 10, align: "right" });
    for (const line of lines) {
      text(line, { size: 10 });
      y -= 13;
    }
    y -= 3;
  }
  rule();

  ensure(40);
  text("Total produits payé", { size: 11, font: bold });
  text(formatFcfa(data.totalFcfa), { size: 13, font: bold, align: "right" });
  y -= 16;
  if (data.paymentLabel) {
    text(`Paiement : ${data.paymentLabel}${data.paymentReference ? ` · réf. ${data.paymentReference}` : ""}`, { size: 9.5, color: DOUX });
    y -= 13;
  }
  if (data.fulfillment === "delivery") {
    for (const line of wrap(clean("Frais de livraison non compris : ils sont réglés directement au livreur selon votre position."), regular, 9, width - margin * 2)) {
      ensure(12);
      text(line, { size: 9, color: DOUX });
      y -= 12;
    }
  }

  // Pied de page
  ensure(30);
  y -= 10;
  text("Merci et à très vite.", { size: 10, font: bold, color: CARAMEL, align: "center" });
  y -= 13;
  text(`${brand.email} · ohmegato.com`, { size: 8.5, color: DOUX, align: "center" });

  return pdf.save();
}

/** Réponse HTTP d'un reçu : téléchargement direct, jamais mis en cache ni indexé. */
export function receiptResponse(bytes: Uint8Array, reference: string): Response {
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${receiptFilename(reference)}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
