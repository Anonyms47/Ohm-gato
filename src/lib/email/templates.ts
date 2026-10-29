/**
 * E-mails transactionnels d'OHMEGATO : texte simple et HTML sobre, en français.
 * Module pur (aucun envoi) : testable et partagé par la file d'envoi.
 */
import { brand } from "@/config/brand";
import { formatSlot } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";

export type EmailTemplate =
  | "order_registered"
  | "payment_confirmed"
  | "order_preparing"
  | "order_ready"
  | "pickup_ready"
  | "out_for_delivery"
  | "order_cancelled"
  | "order_delivered"
  | "refund_recorded"
  | "admin_digest";

/** Logo servi par le site (adresse publique, lisible par les messageries). */
const LOGO_URL = "https://ohmegato.com/brand/logo-ohmegato.png";

export interface OrderEmailData {
  customerName: string;
  reference: string;
  totalFcfa: number;
  fulfillment: "pickup" | "delivery";
  slot: { startsAt: string; endsAt: string } | null;
  pickupCode: string | null;
  trackingUrl: string;
  receiptUrl: string | null;
  refund?: { amountFcfa: number; method: string } | null;
  /** Livraison : frais de la zone au moment de la commande (null = tarif confirmé selon la position). */
  deliveryFeeFcfa?: number | null;
  deliveryZoneName?: string | null;
  /** Moyen de paiement choisi (Wave par défaut). */
  paymentLabel?: string | null;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
  /** Adresse de désinscription en un clic (alertes) : en-tête List-Unsubscribe. */
  listUnsubscribe?: string;
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function wrap(subject: string, paragraphs: string[], link: { label: string; url: string } | null, extra?: { note: string; unsubscribeUrl: string; oneClickUrl?: string }): RenderedEmail {
  const text = [...paragraphs, link ? `${link.label} : ${link.url}` : null, "", `${brand.name} · ${brand.phoneDisplay} · ohmegato.com`, extra ? `${extra.note}\nSe désinscrire : ${extra.unsubscribeUrl}` : null].filter((l) => l !== null).join("\n\n");
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f5e9d6;font-family:Arial,sans-serif;color:#4a2a1c">
<div style="max-width:560px;margin:0 auto;padding:24px">
<p style="margin:0 0 16px;text-align:center"><img src="${LOGO_URL}" alt="${brand.name}" width="88" height="88" style="display:inline-block;width:88px;height:88px;border:0"></p>
<div style="background:#fbf6ee;border-radius:12px;padding:20px">
${paragraphs.map((p) => `<p style="font-size:16px;line-height:1.5;margin:0 0 12px">${escape(p)}</p>`).join("\n")}
${link ? `<p style="margin:16px 0 0"><a href="${escape(link.url)}" style="display:inline-block;background:#4a2a1c;color:#f5e9d6;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold">${escape(link.label)}</a></p>` : ""}
</div>
<p style="font-size:13px;color:#6b4a3a;margin:16px 0 0">${escape(brand.name)} · ${escape(brand.phoneDisplay)} · ohmegato.com</p>
${extra ? `<p style="font-size:12px;color:#6b4a3a;margin:12px 0 0">${escape(extra.note)} <a href="${escape(extra.unsubscribeUrl)}" style="color:#6b4a3a">Se désinscrire</a></p>` : ""}
</div></body></html>`;
  return { subject, text, html, listUnsubscribe: extra ? (extra.oneClickUrl ?? extra.unsubscribeUrl) : undefined };
}

export function renderOrderEmail(template: Exclude<EmailTemplate, "admin_digest">, d: OrderEmailData): RenderedEmail {
  const first = d.customerName.split(/\s+/)[0] || d.customerName;
  const hello = `Bonjour ${first},`;
  const slot = d.slot ? formatSlot(d.slot.startsAt, d.slot.endsAt) : null;
  const follow = { label: "Suivre ma commande", url: d.trackingUrl };
  const method = d.paymentLabel?.trim() || "Wave";
  // Livraison : montant de la zone (ou tarif confirmé selon la position), toujours réglé au livreur et jamais inclus dans le paiement en ligne.
  const feeLine =
    d.fulfillment === "delivery"
      ? typeof d.deliveryFeeFcfa === "number"
        ? `Livraison${d.deliveryZoneName ? ` (${d.deliveryZoneName})` : ""} : ${formatFcfa(d.deliveryFeeFcfa)}, à régler directement au livreur. Ce montant n'est pas inclus dans votre paiement en ligne.`
        : "Frais de livraison : tarif confirmé selon votre position, à régler directement au livreur. Non inclus dans votre paiement en ligne."
      : "";
  switch (template) {
    case "order_registered":
      return wrap(`Commande ${d.reference} enregistrée`, [
        hello,
        `Votre commande ${d.reference} (${formatFcfa(d.totalFcfa)} de produits) est bien enregistrée.`,
        `Nous vérifions votre paiement ${method} : vous recevrez un e-mail dès qu'il est confirmé.`,
        feeLine,
      ].filter(Boolean), follow);
    case "payment_confirmed":
      return wrap(`Paiement reçu pour ${d.reference}`, [
        hello,
        `Nous avons bien reçu votre paiement de ${formatFcfa(d.totalFcfa)} pour la commande ${d.reference}. Merci !`,
        feeLine,
        d.receiptUrl ? "Votre reçu est disponible depuis la page de suivi." : "",
      ].filter(Boolean), follow);
    case "order_preparing":
      return wrap(`${d.reference} : en préparation`, [hello, `Nous préparons votre commande ${d.reference}.`, slot ? `${d.fulfillment === "pickup" ? "Retrait" : "Livraison"} prévu : ${slot}.` : ""].filter(Boolean), follow);
    case "pickup_ready":
      return wrap(`${d.reference} est prête au retrait`, [
        hello,
        `Votre commande ${d.reference} est prête.`,
        `Retrait : ${brand.pickupAddress}, ${brand.city}${slot ? `, ${slot}` : ""}.`,
        d.pickupCode ? `Votre code de retrait : ${d.pickupCode}.` : "",
      ].filter(Boolean), follow);
    case "order_ready":
      return wrap(`${d.reference} est prête`, [hello, `Votre commande ${d.reference} est prête et sera bientôt confiée à notre livreur.`, slot ? `Créneau de livraison : ${slot}.` : ""].filter(Boolean), follow);
    case "out_for_delivery":
      return wrap(`${d.reference} est en route`, [
        hello,
        `Votre commande ${d.reference} est en route avec notre livreur.`,
        typeof d.deliveryFeeFcfa === "number" ? `Frais de livraison : ${formatFcfa(d.deliveryFeeFcfa)}, à régler directement au livreur.` : "Les frais de livraison se règlent directement au livreur.",
      ], follow);
    case "order_cancelled":
      return wrap(`Commande ${d.reference} annulée`, [
        hello,
        `Votre commande ${d.reference} a été annulée.`,
        `Pour toute question, écrivez-nous ou appelez le ${brand.phoneDisplay}.`,
      ], follow);
    case "order_delivered":
      return wrap(d.fulfillment === "pickup" ? `${d.reference} : commande retirée` : `${d.reference} : commande livrée`, [
        hello,
        d.fulfillment === "pickup" ? `Votre commande ${d.reference} a bien été retirée.` : `Votre commande ${d.reference} a bien été livrée.`,
        "Merci pour votre confiance et bonne dégustation !",
        d.receiptUrl ? "Votre reçu reste disponible depuis la page de suivi." : "",
      ].filter(Boolean), follow);
    case "refund_recorded":
      return wrap(`Remboursement de ${d.reference}`, [
        hello,
        d.refund ? `Nous avons enregistré un remboursement de ${formatFcfa(d.refund.amountFcfa)} (${d.refund.method}) pour la commande ${d.reference}.` : `Un remboursement a été enregistré pour la commande ${d.reference}.`,
      ], follow);
  }
}

export function renderDigest(date: string, lines: string[], adminUrl: string): RenderedEmail {
  return wrap(`Atelier OHMEGATO — ${date}`, lines.length ? ["Bonjour Alima, voici ce qui attend dans l'atelier :", ...lines.map((l) => `• ${l}`)] : ["Bonjour Alima, aucune action n'attend aujourd'hui."], {
    label: "Ouvrir l'atelier",
    url: adminUrl,
  });
}

/** E-mail d'essai envoyé depuis l'atelier à l'adresse de la marque (jamais à une cliente). */
export function renderTestEmail(sentAt: string): RenderedEmail {
  return wrap("Essai d'envoi OHMEGATO", [
    "Bonjour,",
    `Cet e-mail d'essai a été envoyé depuis l'atelier le ${sentAt}.`,
    "S'il est arrivé, les e-mails de commande partent correctement vers les clientes.",
  ], null);
}

export interface BatchAlertData {
  cycleNumber: number;
  /** Phrase officielle de la précommande (« Commandez avant le … »), issue des dates réelles de la fournée. */
  message: string;
  siteUrl: string;
  /** Page de désinscription (lien du message). */
  unsubscribeUrl: string;
  /** Adresse acceptant un POST (désinscription en un clic de la messagerie). */
  oneClickUrl: string;
}

/** Alerte d'ouverture d'une fournée, envoyée seulement sur déclenchement explicite de l'administratrice. */
export function renderBatchAlert(d: BatchAlertData): RenderedEmail {
  return wrap(
    `La fournée n°${d.cycleNumber} est ouverte`,
    [
      "Bonjour,",
      `La fournée n°${d.cycleNumber} d'OHMEGATO est ouverte.`,
      d.message,
      "Composez votre boîte sur ohmegato.com.",
    ],
    { label: "Voir la fournée", url: d.siteUrl },
    {
      note: "Vous recevez cet e-mail parce que vous avez demandé à être prévenu(e) de l'ouverture de la prochaine fournée.",
      unsubscribeUrl: d.unsubscribeUrl,
      oneClickUrl: d.oneClickUrl,
    },
  );
}
