import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BrandHeading } from "@/components/brand/BrandHeading";
import { serverEnv } from "@/lib/env";
import { formatFcfa } from "@/lib/money";
import { buildTestWebhook, TEST_SIGNATURE_HEADER, testProvider } from "@/lib/payments/test-provider";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Paiement de test", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Retour autorisé uniquement vers ce site (pas de redirection ouverte). */
function safeReturn(url: string | undefined): string {
  const site = new URL(serverEnv().NEXT_PUBLIC_SITE_URL);
  try {
    const target = new URL(url ?? "/", site);
    return target.origin === site.origin ? target.pathname + target.search : "/";
  } catch {
    return "/";
  }
}

async function loadPayment(paymentId: string, session: string | undefined) {
  if (!testProvider.isConfigured() || !UUID.test(paymentId)) return null;
  const { data } = await supabaseAdmin()
    .from("payments")
    .select("id, amount_fcfa, status, provider, provider_session_id, orders(reference)")
    .eq("id", paymentId)
    .eq("provider", "test")
    .maybeSingle<{ id: string; amount_fcfa: number; status: string; provider_session_id: string | null; orders: { reference: string } }>();
  if (!data || !session || data.provider_session_id !== session) return null;
  return data;
}

export default async function PaiementTestPage({
  params,
  searchParams,
}: {
  params: Promise<{ paymentId: string }>;
  searchParams: Promise<{ session?: string; retour?: string }>;
}) {
  const [{ paymentId }, { session, retour }] = await Promise.all([params, searchParams]);
  const payment = await loadPayment(paymentId, session);
  if (!payment) notFound();
  const returnTo = safeReturn(retour);

  async function simulate(formData: FormData) {
    "use server";
    const outcome = formData.get("outcome");
    const current = await loadPayment(paymentId, session);
    if (!current) notFound();
    if (outcome === "paid" || outcome === "failed" || outcome === "cancelled") {
      const { body, signature } = buildTestWebhook({ paymentId, status: outcome, amountFcfa: current.amount_fcfa });
      // Le webhook passe par la vraie route HTTP, signature comprise.
      await fetch(new URL("/api/payments/webhook/test", serverEnv().NEXT_PUBLIC_SITE_URL), {
        method: "POST",
        headers: { "Content-Type": "application/json", [TEST_SIGNATURE_HEADER]: signature },
        body,
      });
    }
    redirect(returnTo);
  }

  const button = "min-h-12 rounded-[10px] border-2 px-5 font-bold";
  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <p className="mb-4 rounded-[10px] border-2 border-orange-encre p-3 font-bold text-orange-encre">
        Environnement de test : aucun argent réel n&apos;est utilisé.
      </p>
      <BrandHeading as="h1" size="section">
        Paiement de test
      </BrandHeading>
      <p className="mt-3 text-[1.1rem]">
        Commande {payment.orders.reference} — <strong>{formatFcfa(payment.amount_fcfa)}</strong>
      </p>
      <p className="mt-1 text-encre-douce">Statut actuel : {payment.status}</p>
      <form action={simulate} className="mt-6 flex flex-col gap-3">
        <button name="outcome" value="paid" className={`${button} border-succes bg-succes text-blanc-casse`}>
          Simuler un paiement réussi
        </button>
        <button name="outcome" value="failed" className={`${button} border-erreur text-erreur`}>
          Simuler un échec
        </button>
        <button name="outcome" value="cancelled" className={`${button} border-chocolat`}>
          Simuler une annulation
        </button>
        <button name="outcome" value="pending" className={`${button} border-chocolat/35`}>
          Revenir sans payer (reste en attente)
        </button>
      </form>
    </div>
  );
}
