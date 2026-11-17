import { ZonesManager } from "@/components/admin/ZoneEditors";
import { listAllZones } from "@/lib/admin/zones";
import { requireAdmin } from "@/lib/auth/session";

export const metadata = { title: "Zones de livraison" };

export default async function AdminZones() {
  await requireAdmin();
  const zones = await listAllZones();
  const active = zones.filter((z) => z.isActive);
  const noFee = active.filter((z) => z.feeFcfa === null);
  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="font-display text-[clamp(1.8rem,4vw,2.4rem)]">Zones de livraison</h1>
        <p className="mt-2 text-encre-douce">
          Chaque zone regroupe des quartiers et porte un tarif. La cliente choisit son quartier, voit le tarif, puis le règle directement au livreur : il n&apos;est jamais ajouté
          au paiement en ligne. Une commande garde le tarif du jour où elle a été passée.
        </p>
      </div>
      {active.length === 0 && (
        <p role="status" className="rounded-[12px] border-2 border-caramel-encre bg-blanc-casse p-4 font-bold text-caramel-encre" data-testid="alerte-zones">
          Aucune zone active : le bon de fournée affiche « Tarif confirmé selon votre position ». Rien n&apos;est bloqué ; ajoutez ou importez votre grille quand elle est prête.
        </p>
      )}
      {noFee.length > 0 && (
        <p role="status" className="rounded-[12px] border-2 border-chocolat/20 bg-blanc-casse p-4">
          {noFee.length} zone{noFee.length > 1 ? "s" : ""} active{noFee.length > 1 ? "s" : ""} sans tarif : « tarif confirmé selon la position » sera affiché ({noFee.map((z) => z.name).join(", ")}).
        </p>
      )}
      <ZonesManager zones={zones} />
    </div>
  );
}
