import { describe, expect, it } from "vitest";
import { renderDigest, renderOrderEmail, type OrderEmailData } from "@/lib/email/templates";

const data: OrderEmailData = {
  customerName: "Awa Diop",
  reference: "OHM1-0001",
  totalFcfa: 4500,
  fulfillment: "pickup",
  slot: { startsAt: "2026-10-23T10:00:00Z", endsAt: "2026-10-23T18:00:00Z" },
  pickupCode: "HD8NTU",
  trackingUrl: "https://ohmegato.com/suivi/abc",
  receiptUrl: null,
};

describe("e-mails transactionnels", () => {
  it("chaque étape a son objet et le lien de suivi", () => {
    for (const template of ["order_registered", "payment_confirmed", "order_preparing", "order_ready", "pickup_ready", "out_for_delivery", "order_cancelled", "refund_recorded"] as const) {
      const email = renderOrderEmail(template, data);
      expect(email.subject).toContain("OHM1-0001");
      expect(email.text).toContain("Bonjour Awa,");
      expect(email.text).toContain("https://ohmegato.com/suivi/abc");
      expect(email.html).toContain("https://ohmegato.com/suivi/abc");
    }
  });

  it("retrait : adresse et code ; livraison : frais réglés au livreur", () => {
    expect(renderOrderEmail("pickup_ready", data).text).toContain("HD8NTU");
    expect(renderOrderEmail("out_for_delivery", { ...data, fulfillment: "delivery" }).text).toContain("directement au livreur");
  });

  it("le reçu n'est mentionné qu'une fois le paiement vérifié", () => {
    expect(renderOrderEmail("payment_confirmed", data).text).not.toContain("reçu est disponible");
    expect(renderOrderEmail("payment_confirmed", { ...data, receiptUrl: "https://ohmegato.com/suivi/abc/recu" }).text).toContain("reçu est disponible");
  });

  it("le HTML échappe les données saisies", () => {
    expect(renderOrderEmail("order_registered", { ...data, customerName: "<script>x</script>" }).html).not.toContain("<script>x");
  });

  it("résumé quotidien : liste réelle ou rien à signaler", () => {
    expect(renderDigest("2026-10-15", [], "https://ohmegato.com/admin").text).toContain("aucune action");
    expect(renderDigest("2026-10-15", ["2 paiements"], "https://ohmegato.com/admin").text).toContain("• 2 paiements");
  });
});
