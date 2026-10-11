import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildReceiptPdf, receiptFilename, type ReceiptData } from "@/lib/receipt/pdf";

const base: ReceiptData = {
  reference: "OHM1-0001",
  createdAt: "2026-10-12T09:30:00Z",
  paidAt: "2026-10-12T09:35:00Z",
  customerName: "Awa Diop",
  fulfillment: "pickup",
  slot: { startsAt: "2026-10-23T10:00:00Z", endsAt: "2026-10-23T18:00:00Z" },
  items: [
    { productName: "Cookies", variantLabel: "Box de 6", flavorName: null, quantity: 2, lineTotalFcfa: 9000 },
    { productName: "Verrines fruitées", variantLabel: "Unité", flavorName: "Mangue", quantity: 1, lineTotalFcfa: 1500 },
  ],
  totalFcfa: 10500,
  paymentLabel: "Wave (lien marchand)",
  paymentReference: "W-1",
};

describe("reçu PDF", () => {
  it("produit un PDF lisible, titré avec le numéro de commande", async () => {
    const bytes = await buildReceiptPdf(base);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toBe("Reçu OHM1-0001");
    expect(doc.getAuthor()).toBe("OHMEGATO");
    expect(doc.getPageCount()).toBe(1);
  });

  it("supporte les espaces fines des montants, les accents et une livraison sans nom de client", async () => {
    const bytes = await buildReceiptPdf({ ...base, customerName: null, fulfillment: "delivery", paymentReference: null });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });

  it("passe sur une page suivante quand la commande est longue", async () => {
    const items = Array.from({ length: 40 }, (_, i) => ({ ...base.items[0]!, productName: `Produit ${i + 1}` }));
    const doc = await PDFDocument.load(await buildReceiptPdf({ ...base, items }));
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });

  it("nom de fichier sûr", () => {
    expect(receiptFilename("OHM1-0001")).toBe("recu-OHM1-0001.pdf");
    expect(receiptFilename('OHM1-"0001/../x')).toBe("recu-OHM1-0001x.pdf");
  });
});
