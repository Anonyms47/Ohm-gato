import { listAudit } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/auth/session";
import { formatDay, formatTime } from "@/lib/dates";
import { statusHeadline } from "@/lib/order-status";
import type { OrderStatus } from "@/lib/order-status";

export const metadata = { title: "Journal d'activité" };

const LABELS: Record<string, string> = {
  "cycle.create": "Fournée créée",
  "cycle.update": "Fournée modifiée",
  "cycle.status": "Statut de fournée",
  "cycle.products": "Produits de fournée",
  "stock.set": "Stock ajusté",
  "cycle.extra": "Quantité supplémentaire décidée",
  "cycle.production": "Production réelle saisie",
  "cycle.surplus_publish": "Surplus publié",
  "cycle.surplus_withdraw": "Produit retiré du surplus",
  "slot.create": "Créneau ajouté",
  "slot.enable": "Créneau réactivé",
  "slot.disable": "Créneau désactivé",
  "slot.delete": "Créneau supprimé",
  "order.status": "Statut de commande",
  "order.payment_recorded": "Paiement vérifié et enregistré",
  "order.note": "Note interne ajoutée",
  "order.payment_not_found": "Paiement introuvable pour le moment",
  "order.bulk_status": "Statut changé pour plusieurs commandes",
  "cycle.duplicate": "Fournée créée depuis la précédente",
  "cycle.production_print": "Fiche de production imprimée",
  "automation.run": "Automatisations exécutées",
  "automation.settings": "Délais des alertes modifiés",
  "product.create": "Produit créé",
  "product.update": "Produit modifié",
  "variant.create": "Format ajouté",
  "variant.update": "Format modifié",
  "product.flavors": "Parfums modifiés",
  "product.allergens": "Allergènes modifiés",
  "product.image.add": "Photo ajoutée",
  "product.image.delete": "Photo supprimée",
  "custom.status": "Statut sur-mesure",
  "custom.message": "Message sur-mesure",
  "custom.proposal": "Proposition envoyée",
  "customer.note.add": "Note client ajoutée",
  "customer.note.delete": "Note client supprimée",
  "settings.update": "Réglage modifié",
  "settings.workshop_traces": "Traces d’atelier modifiées",
  "story.media.add": "Média ajouté",
  "story.media.remove": "Média retiré",
  "role.grant": "Rôle attribué",
  "role.revoke": "Rôle retiré",
  "legal.draft": "Brouillon de document enregistré",
  "legal.publish": "Document publié",
  "legal.restore": "Ancienne version reprise",
  "legal.discard": "Brouillon de document abandonné",
  "refund.record": "Remboursement enregistré",
  "account.delete": "Compte supprimé par son titulaire",
  "zone.create": "Zone de livraison créée",
  "zone.update": "Zone de livraison modifiée",
  "zone.duplicate": "Zone de livraison dupliquée",
  "zone.activate": "Zone de livraison activée",
  "zone.deactivate": "Zone de livraison désactivée",
  "zone.reorder": "Zones réorganisées",
  "zones.import": "Grille de zones importée (CSV)",
  "zones.export": "Grille de zones exportée (CSV)",
  "payment_method.update": "Moyen de paiement modifié",
  "social.snapchat.update": "Snapchat modifié",
  "social.snapchat.clear": "Snapchat retiré",
  "alert.trigger": "Alerte de prochaine fournée déclenchée",
  "alert.retry": "Envois d'alerte repris",
  "alert.unsubscribe": "Inscrit désinscrit par l'équipe",
  "alert.export": "Liste des inscrits exportée",
};

const CYCLE_STATUS: Record<string, string> = {
  draft: "brouillon",
  scheduled: "programmée",
  open: "ouverte",
  closed: "précommandes clôturées",
  preparing: "en production",
  delivering: "en livraison",
  surplus: "surplus en vente",
  done: "terminée",
  cancelled: "annulée",
};

/** Bruit technique, jamais utile à relire. */
const HIDDEN = new Set(["automation.run"]);

const text = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : null);

/** Détail lisible d'une action (jamais de données brutes). */
function describe(action: string, details: unknown): string | null {
  const d = (details && typeof details === "object" ? details : {}) as Record<string, unknown>;
  switch (action) {
    case "order.status": {
      const to = text(d.to);
      const label = to ? (statusHeadline[to as OrderStatus] ?? to) : null;
      return [text(d.reference), label && `→ ${label}`, text(d.note)].filter(Boolean).join(" ") || null;
    }
    case "cycle.status": {
      const to = text(d.to);
      return to ? `Fournée ${CYCLE_STATUS[to] ?? to}` : null;
    }
    case "order.payment_recorded":
    case "order.payment_not_found":
      return text(d.reference);
    case "legal.publish":
      return [text(d.slug), d.version ? `version ${text(d.version)}` : null].filter(Boolean).join(", ") || null;
    case "zone.create":
    case "zone.update":
    case "zone.duplicate":
      return text(d.name);
    case "zones.import":
      return d.created !== undefined || d.updated !== undefined ? `${text(d.created) ?? 0} créée(s), ${text(d.updated) ?? 0} mise(s) à jour` : null;
    case "payment_method.update":
      return d.enabled === true ? "activé" : d.enabled === false ? "désactivé" : null;
    case "alert.trigger":
      return [d.cycle ? `fournée n°${text(d.cycle)}` : null, d.recipients !== undefined ? `${text(d.recipients)} destinataire(s)` : null].filter(Boolean).join(", ") || null;
    case "refund.record":
      return d.amount_fcfa ? `${text(d.amount_fcfa)} FCFA` : null;
    case "settings.update":
    case "product.update":
    case "product.create":
      return text(d.name) ?? text(d.field) ?? null;
    default:
      return text(d.reference) ?? null;
  }
}

export default async function Journal() {
  await requireAdmin();
  const entries = (await listAudit()).filter((e) => !HIDDEN.has(e.action));
  const days = new Map<string, typeof entries>();
  for (const e of entries) {
    const day = formatDay(e.created_at);
    days.set(day, [...(days.get(day) ?? []), e]);
  }
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="font-display text-[clamp(1.8rem,4vw,2.4rem)]">Journal d&apos;activité</h1>
        <p className="text-encre-douce">Ce qui s&apos;est passé dans l&apos;atelier, du plus récent au plus ancien. Rien ne peut y être modifié.</p>
      </header>
      {entries.length === 0 && <p className="text-encre-douce">Aucune action pour l&apos;instant.</p>}
      {[...days.entries()].map(([day, list]) => (
        <section key={day} aria-label={day} className="flex flex-col gap-2">
          <h2 className="font-display text-[1.25rem] first-letter:uppercase">{day}</h2>
          <ul className="flex flex-col divide-y divide-dashed divide-chocolat/15 rounded-[12px] border-2 border-chocolat/10 bg-blanc-casse">
            {list.map((e) => {
              const detail = describe(e.action, e.details);
              return (
                <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-3">
                  <span className="w-12 shrink-0 tabular-nums text-encre-douce">{formatTime(e.created_at)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="font-bold">{LABELS[e.action] ?? e.action}</span>
                    {detail && <span className="block text-[0.95rem] text-encre-douce">{detail}</span>}
                  </span>
                  <span className="text-[0.9rem] text-encre-douce">{e.actor === "Système" ? "Automatique" : e.actor}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
