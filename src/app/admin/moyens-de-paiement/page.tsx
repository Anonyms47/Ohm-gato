import { PaymentMethodForm, type PaymentMethodView } from "@/components/admin/PaymentMethodEditors";
import { requireAdmin } from "@/lib/auth/session";
import { formatShortDay, formatTime } from "@/lib/dates";
import { getPaymentSettings, isUsable, safeMerchantLink } from "@/lib/payments/settings";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const metadata = { title: "Moyens de paiement" };

export default async function AdminMoyensDePaiement() {
  await requireAdmin();
  const settings = await getPaymentSettings();
  // Lien saisi dans l'atelier (le repli historique n'est jamais recopié dans le champ).
  const { data } = await supabaseAdmin().from("payment_method_settings").select("provider, merchant_link");
  const own = new Map((data ?? []).map((r) => [r.provider as string, safeMerchantLink(r.merchant_link as string | null) ?? ""]));
  const views: PaymentMethodView[] = (["wave", "orange_money"] as const).map((provider) => {
    const s = settings[provider];
    let fallbackHost: string | null = null;
    if (s.linkSource === "environnement" && s.merchantLink) fallbackHost = new URL(s.merchantLink).hostname;
    return { provider, displayName: s.displayName, link: own.get(provider) ?? "", fallbackHost, enabled: s.enabled, instructions: s.instructions ?? "", updatedAt: s.updatedAt, live: isUsable(s) };
  });
  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <div>
        <h1 className="font-display text-[clamp(1.8rem,4vw,2.4rem)]">Moyens de paiement</h1>
        <p className="mt-2 text-encre-douce">
          Wave et Orange Money fonctionnent par lien marchand. Seule une administratrice marque une commande « payée », après avoir vu le paiement dans l&apos;application du
          moyen : ouvrir le lien ne vaut jamais paiement. Les frais de livraison ne sont jamais inclus : la cliente les règle au livreur.
        </p>
      </div>
      {views.map((m) => (
        <section key={m.provider} aria-labelledby={`titre-${m.provider}`} className="atelier-ticket flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id={`titre-${m.provider}`} className="font-display text-[1.5rem]">
              {m.provider === "wave" ? "Wave" : "Orange Money"}
            </h2>
            <span className={`rounded-full px-3 py-1 font-bold ${m.live ? "bg-succes text-blanc-casse" : "bg-creme text-encre-douce"}`} data-testid={`statut-${m.provider}`}>
              {m.live ? "Proposé aux clientes" : m.enabled ? "Activé, masqué : aucun lien" : "Désactivé"}
            </span>
          </div>
          {m.updatedAt && <p className="text-[0.95rem] text-encre-douce">Dernière modification : {formatShortDay(m.updatedAt)} à {formatTime(m.updatedAt)}</p>}
          <PaymentMethodForm method={m} />
        </section>
      ))}
    </div>
  );
}
