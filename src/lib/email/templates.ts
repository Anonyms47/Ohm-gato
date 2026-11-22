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

/** Logo servi par le site (adresse publique). Version à fond crème opaque : les messageries en mode sombre n'inversent pas une image opaque, le logotype reste lisible. */
const LOGO_URL = "https://ohmegato.com/brand/logotype-ohmegato-email.png";

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

interface MailParts {
  subject: string;
  /** Titre affiché en haut de la carte (distinct de l'objet). */
  title: string;
  /** Petite ligne d'aperçu affichée par la messagerie à côté de l'objet. */
  preheader: string;
  paragraphs: string[];
  /** Détails clés de la commande, en lignes « libellé : valeur ». */
  facts?: [string, string][];
  link: { label: string; url: string } | null;
  extra?: { note: string; unsubscribeUrl: string; oneClickUrl?: string };
  /** Valeur mise en avant dans un cadre (code de connexion, code de retrait). */
  highlight?: { label?: string; value: string };
  /** Aucun lien cliquable (code de connexion : rien à suivre, rien à imiter). */
  noLinks?: boolean;
}

const C = { creme: "#f5e9d6", blanc: "#fbf6ee", chocolat: "#3a2418", cacao: "#24140d", caramel: "#8f5216", rose: "#dca7ae", roseVif: "#e58aa0", grille: "#e7cfc4", douce: "#6b4a3a" };
const FONT = "'Jost','Trebuchet MS',Arial,sans-serif";

function wrap(m: MailParts): RenderedEmail {
  const { subject, title, preheader, paragraphs, facts, link, extra, highlight, noLinks } = m;
  const logoImg = `<img src="${LOGO_URL}" alt="${brand.name}" width="240" height="103" style="display:block;width:240px;max-width:100%;height:auto;border:0;border-radius:12px">`;
  const text = [
    title,
    ...paragraphs,
    facts?.length ? facts.map(([k, v]) => `${k} : ${v}`).join("\n") : null,
    highlight ? `${highlight.label ? `${highlight.label}\n` : ""}${highlight.value}` : null,
    link ? `${link.label} : ${link.url}` : null,
    `${brand.name} · ${brand.phoneDisplay} · ${brand.email} · ohmegato.com`,
    extra ? `${extra.note}\nSe désinscrire : ${extra.unsubscribeUrl}` : null,
  ].filter((l) => l !== null).join("\n\n");
  const body = paragraphs
    .map((p) =>
      p.startsWith("• ")
        ? `<p class="ohm-txt" style="font-size:16px;line-height:1.55;margin:0 0 8px;padding-left:18px;text-indent:-18px;color:${C.chocolat}"><span style="color:${C.caramel}">•</span>&nbsp; ${escape(p.slice(2))}</p>`
        : `<p class="ohm-txt" style="font-size:16px;line-height:1.6;margin:0 0 14px;color:${C.chocolat}">${escape(p)}</p>`,
    )
    .join("\n");
  const factRows = facts?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="ohm-facts" style="margin:18px 0;border:1px solid ${C.grille};border-radius:10px;border-collapse:separate;background:${C.creme}">${facts
        .map(
          ([k, v], i) =>
            `<tr><td class="ohm-soft" style="padding:10px 14px;font-size:13px;color:${C.douce};${i ? `border-top:1px solid ${C.grille};` : ""}width:38%">${escape(k)}</td><td class="ohm-txt" style="padding:10px 14px;font-size:15px;font-weight:600;color:${C.chocolat};${i ? `border-top:1px solid ${C.grille};` : ""}">${escape(v)}</td></tr>`,
        )
        .join("")}</table>`
    : "";
  const highlightBox = highlight
    ? `<div style="margin:20px 0;text-align:center">${highlight.label ? `<p class="ohm-soft" style="margin:0 0 8px;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:${C.douce}">${escape(highlight.label)}</p>` : ""}<span class="ohm-code" style="display:inline-block;background:${C.creme};border:2px solid ${C.chocolat};border-radius:12px;padding:14px 22px 14px 30px;font-size:34px;font-weight:700;letter-spacing:9px;color:${C.chocolat}">${escape(highlight.value)}</span></div>`
    : "";
  const button = link
    ? `<p style="margin:22px 0 4px;text-align:center"><a href="${escape(link.url)}" class="ohm-btn" style="display:inline-block;background:${C.chocolat};color:${C.creme};padding:14px 26px;border-radius:999px;text-decoration:none;font-weight:700;font-size:16px">${escape(link.label)}</a></p>`
    : "";
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${escape(subject)}</title>
<style>@media (prefers-color-scheme: dark){.ohm-bg{background:${C.cacao}!important}.ohm-card{background:${C.chocolat}!important;border-color:#5a3a2a!important;border-top-color:#f0a8b8!important}.ohm-txt,.ohm-title{color:${C.creme}!important}.ohm-soft{color:#d9c3a8!important}.ohm-facts{background:${C.cacao}!important;border-color:#5a3a2a!important}.ohm-link{color:#e8c9a0!important}.ohm-btn{background:${C.creme}!important;color:${C.chocolat}!important}}</style></head>
<body class="ohm-bg" style="margin:0;padding:0;background:${C.creme};font-family:${FONT};color:${C.chocolat}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escape(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="ohm-bg" style="background:${C.creme}"><tr><td align="center" style="padding:24px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td align="center" style="padding:0 0 18px">${noLinks ? logoImg : `<a href="https://ohmegato.com">${logoImg}</a>`}</td></tr>
<tr><td class="ohm-card" style="background:${C.blanc};border:1px solid ${C.grille};border-top:6px solid ${C.roseVif};border-radius:14px;padding:28px 24px">
<h1 class="ohm-title" style="margin:0 0 16px;font-size:24px;line-height:1.25;font-weight:700;color:${C.chocolat}">${escape(title)}</h1>
${body}
${factRows}
${highlightBox}
${button}
</td></tr>
<tr><td align="center" style="padding:20px 8px 0">
<p class="ohm-soft" style="margin:0 0 6px;font-size:14px;line-height:1.5;color:${C.douce}">Une question ? Écrivez-nous sur ${noLinks ? "WhatsApp" : `<a href="${brand.whatsappUrl}" class="ohm-link" style="color:${C.caramel}">WhatsApp</a>`} ou au <span style="white-space:nowrap">${escape(brand.phoneDisplay)}</span>.</p>
<p class="ohm-soft" style="margin:0;font-size:13px;color:${C.douce}">${escape(brand.name)} · pâtisseries maison · ${escape(brand.city)} · ${noLinks ? "ohmegato.com" : `<a href="https://ohmegato.com" class="ohm-link" style="color:${C.douce}">ohmegato.com</a>`}</p>
${extra ? `<p class="ohm-soft" style="margin:12px 0 0;font-size:12px;line-height:1.5;color:${C.douce}">${escape(extra.note)} <a href="${escape(extra.unsubscribeUrl)}" class="ohm-link" style="color:${C.douce}">Se désinscrire</a></p>` : ""}
</td></tr></table></td></tr></table></body></html>`;
  return { subject, text, html, listUnsubscribe: extra ? (extra.oneClickUrl ?? extra.unsubscribeUrl) : undefined };
}

export function renderOrderEmail(template: Exclude<EmailTemplate, "admin_digest">, d: OrderEmailData): RenderedEmail {
  const first = d.customerName.split(/\s+/)[0] || d.customerName;
  const hello = `Bonjour ${first},`;
  const slot = d.slot ? formatSlot(d.slot.startsAt, d.slot.endsAt) : null;
  const follow = { label: "Suivre ma commande", url: d.trackingUrl };
  const method = d.paymentLabel?.trim() || "Wave";
  const modeLabel = d.fulfillment === "pickup" ? "Retrait gratuit" : "Livraison à Dakar";
  const slotLabel = d.fulfillment === "pickup" ? "Retrait" : "Livraison";
  // Livraison : montant de la zone (ou tarif confirmé selon la position), toujours réglé au livreur et jamais inclus dans le paiement en ligne.
  const feeLine =
    d.fulfillment === "delivery"
      ? typeof d.deliveryFeeFcfa === "number"
        ? `Livraison${d.deliveryZoneName ? ` (${d.deliveryZoneName})` : ""} : ${formatFcfa(d.deliveryFeeFcfa)}, à régler directement au livreur. Ce montant n'est pas inclus dans votre paiement en ligne.`
        : "Frais de livraison : tarif confirmé selon votre position, à régler directement au livreur. Non inclus dans votre paiement en ligne."
      : "";
  const summary: [string, string][] = [["Commande", d.reference], ["Produits", formatFcfa(d.totalFcfa)], ["Mode", modeLabel], ...(slot ? ([[slotLabel, slot]] as [string, string][]) : [])];
  switch (template) {
    case "order_registered":
      return wrap({
        subject: `Commande ${d.reference} enregistrée`,
        title: "Votre commande est enregistrée",
        preheader: `Merci ! Nous vérifions votre paiement ${method}, vous serez prévenu(e) dès qu'il est confirmé.`,
        paragraphs: [
          hello,
          "Merci pour votre commande, elle est bien enregistrée.",
          `Nous vérifions maintenant votre paiement ${method} à la main. Vous recevrez un nouvel e-mail dès qu'il est confirmé.`,
          feeLine,
        ].filter(Boolean),
        facts: summary,
        link: follow,
      });
    case "payment_confirmed":
      return wrap({
        subject: `Paiement reçu pour ${d.reference}`,
        title: "Paiement bien reçu, merci !",
        preheader: `Votre paiement de ${formatFcfa(d.totalFcfa)} est confirmé : nous pouvons préparer vos douceurs.`,
        paragraphs: [
          hello,
          `Nous avons bien reçu votre paiement de ${formatFcfa(d.totalFcfa)} pour la commande ${d.reference}. Merci !`,
          "Nous pouvons maintenant préparer vos douceurs.",
          feeLine,
          d.receiptUrl ? "Votre reçu est disponible depuis la page de suivi." : "",
        ].filter(Boolean),
        facts: summary,
        link: follow,
      });
    case "order_preparing":
      return wrap({
        subject: `${d.reference} : en préparation`,
        title: "Vos douceurs sont en préparation",
        preheader: `Nous préparons votre commande ${d.reference}.`,
        paragraphs: [hello, `Nous préparons votre commande ${d.reference}, avec soin.`, slot ? `${slotLabel} prévu : ${slot}.` : ""].filter(Boolean),
        link: follow,
      });
    case "pickup_ready":
      return wrap({
        subject: `${d.reference} est prête au retrait`,
        title: "Votre commande est prête à retirer",
        preheader: d.pickupCode ? `Votre code de retrait : ${d.pickupCode}.` : `Retrait : ${brand.pickupAddress}, ${brand.city}.`,
        paragraphs: [
          hello,
          `Votre commande ${d.reference} est prête.`,
          `Retrait : ${brand.pickupAddress}, ${brand.city}${slot ? `, ${slot}` : ""}.`,
          d.pickupCode ? "Présentez ce code à votre arrivée :" : "",
        ].filter(Boolean),
        highlight: d.pickupCode ? { value: d.pickupCode } : undefined,
        link: follow,
      });
    case "order_ready":
      return wrap({
        subject: `${d.reference} est prête`,
        title: "Votre commande est prête",
        preheader: "Elle sera bientôt confiée à notre livreur.",
        paragraphs: [hello, `Votre commande ${d.reference} est prête et sera bientôt confiée à notre livreur.`, slot ? `Créneau de livraison : ${slot}.` : ""].filter(Boolean),
        link: follow,
      });
    case "out_for_delivery":
      return wrap({
        subject: `${d.reference} est en route`,
        title: "Votre commande est en route",
        preheader: "Notre livreur est en chemin vers vous.",
        paragraphs: [
          hello,
          `Votre commande ${d.reference} est en route avec notre livreur.`,
          typeof d.deliveryFeeFcfa === "number" ? `Frais de livraison : ${formatFcfa(d.deliveryFeeFcfa)}, à régler directement au livreur.` : "Les frais de livraison se règlent directement au livreur.",
        ],
        link: follow,
      });
    case "order_cancelled":
      return wrap({
        subject: `Commande ${d.reference} annulée`,
        title: "Votre commande est annulée",
        preheader: `La commande ${d.reference} a été annulée.`,
        paragraphs: [
          hello,
          `Votre commande ${d.reference} a été annulée.`,
          `Une question, ou un paiement déjà effectué ? Écrivez-nous avec la preuve de votre transaction ou appelez le ${brand.phoneDisplay} : nous regardons cela avec vous.`,
        ],
        link: follow,
      });
    case "order_delivered":
      return wrap({
        subject: d.fulfillment === "pickup" ? `${d.reference} : commande retirée` : `${d.reference} : commande livrée`,
        title: d.fulfillment === "pickup" ? "Commande retirée, merci !" : "Commande livrée, merci !",
        preheader: "Bonne dégustation !",
        paragraphs: [
          hello,
          d.fulfillment === "pickup" ? `Votre commande ${d.reference} a bien été retirée.` : `Votre commande ${d.reference} a bien été livrée.`,
          "Merci pour votre confiance et bonne dégustation !",
          d.receiptUrl ? "Votre reçu reste disponible depuis la page de suivi." : "",
        ].filter(Boolean),
        link: follow,
      });
    case "refund_recorded":
      return wrap({
        subject: `Remboursement de ${d.reference}`,
        title: "Votre remboursement est enregistré",
        preheader: d.refund ? `${formatFcfa(d.refund.amountFcfa)} remboursés pour la commande ${d.reference}.` : `Remboursement enregistré pour la commande ${d.reference}.`,
        paragraphs: [
          hello,
          d.refund ? `Nous avons enregistré un remboursement de ${formatFcfa(d.refund.amountFcfa)} (${d.refund.method}) pour la commande ${d.reference}.` : `Un remboursement a été enregistré pour la commande ${d.reference}.`,
        ],
        link: follow,
      });
  }
}

export function renderDigest(date: string, lines: string[], adminUrl: string): RenderedEmail {
  return wrap({
    subject: `Atelier OHMEGATO — ${date}`,
    title: "L'atelier du jour",
    preheader: lines.length ? `${lines.length} point${lines.length > 1 ? "s" : ""} à regarder aujourd'hui.` : "Rien d'urgent aujourd'hui.",
    paragraphs: lines.length ? ["Bonjour Alima, voici ce qui attend dans l'atelier :", ...lines.map((l) => `• ${l}`)] : ["Bonjour Alima, aucune action n'attend aujourd'hui."],
    link: { label: "Ouvrir l'atelier", url: adminUrl },
  });
}

/** Code de connexion à « Mon carnet » : même charte que les e-mails de commande (aucun lien, seulement le code). */
export function renderLoginCode(code: string, validMinutes = 10): RenderedEmail {
  return wrap({
    subject: `${code} : votre code de connexion OHMEGATO`,
    title: "Votre code de connexion",
    preheader: `${code} : valable ${validMinutes} minutes, à ne partager avec personne.`,
    paragraphs: [
      "Bonjour,",
      `Voici votre code pour ouvrir votre carnet OHMEGATO. Il est valable ${validMinutes} minutes.`,
      "Ne le partagez avec personne. Si vous n'avez rien demandé, ignorez simplement ce message.",
    ],
    highlight: { label: "Votre code", value: code },
    link: null,
    noLinks: true,
  });
}

/** E-mail d'essai envoyé depuis l'atelier à l'adresse de la marque (jamais à une cliente). */
export function renderTestEmail(sentAt: string): RenderedEmail {
  return wrap({
    subject: "Essai d'envoi OHMEGATO",
    title: "Essai d'envoi",
    preheader: "Les e-mails partent correctement.",
    paragraphs: [
      "Bonjour,",
      `Cet e-mail d'essai a été envoyé depuis l'atelier le ${sentAt}.`,
      "S'il est arrivé, les e-mails de commande partent correctement vers les clientes.",
    ],
    link: null,
  });
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
  return wrap({
    subject: `La fournée n°${d.cycleNumber} est ouverte`,
    title: `La fournée n°${d.cycleNumber} est ouverte`,
    preheader: d.message,
    paragraphs: ["Bonjour,", `La fournée n°${d.cycleNumber} d'OHMEGATO est ouverte.`, d.message, "Composez votre boîte sur ohmegato.com."],
    link: { label: "Voir la fournée", url: d.siteUrl },
    extra: {
      note: "Vous recevez cet e-mail parce que vous avez demandé à être prévenu(e) de l'ouverture de la prochaine fournée.",
      unsubscribeUrl: d.unsubscribeUrl,
      oneClickUrl: d.oneClickUrl,
    },
  });
}
