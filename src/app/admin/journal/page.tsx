import { listAudit } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/auth/session";
import { formatShortDay, formatTime } from "@/lib/dates";

export const metadata = { title: "Journal d'audit" };

const LABELS: Record<string, string> = {
  "cycle.create": "Fournée créée",
  "cycle.update": "Fournée modifiée",
  "cycle.status": "Statut de fournée",
  "cycle.products": "Produits de fournée",
  "stock.set": "Stock ajusté",
  "slot.create": "Créneau ajouté",
  "slot.enable": "Créneau réactivé",
  "slot.disable": "Créneau désactivé",
  "slot.delete": "Créneau supprimé",
  "order.status": "Statut de commande",
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
  "account.delete": "Compte supprimé par son titulaire",
};

export default async function Journal() {
  await requireAdmin();
  const entries = await listAudit();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-[clamp(1.8rem,4vw,2.4rem)]">Journal d&apos;audit</h1>
      <p className="text-encre-douce">Toute action sensible de l&apos;administration est inscrite ici et ne peut pas être modifiée.</p>
      <div className="overflow-x-auto rounded-[12px] bg-blanc-casse">
        <table className="w-full min-w-[40rem] text-left">
          <caption className="sr-only">200 dernières actions</caption>
          <thead>
            <tr className="border-b-2 border-chocolat/20">
              <th className="p-2">Date</th>
              <th className="p-2">Par</th>
              <th className="p-2">Action</th>
              <th className="p-2">Détail</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-dashed border-chocolat/15 align-top">
                <td className="p-2 tabular-nums">
                  {formatShortDay(e.created_at)} {formatTime(e.created_at)}
                </td>
                <td className="p-2">{e.actor}</td>
                <td className="p-2">{LABELS[e.action] ?? e.action}</td>
                <td className="max-w-md break-words p-2 text-[0.9rem] text-encre-douce">{e.details ? JSON.stringify(e.details) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
