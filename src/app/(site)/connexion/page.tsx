import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginNotebook } from "@/components/account/LoginNotebook";
import { getCurrentUser, safeNext } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env";

export const metadata: Metadata = {
  title: "Retrouvons votre carnet",
  description: "Connexion à votre carnet OHMEGATO avec un code temporaire, sans mot de passe.",
  robots: { index: false },
};

export default async function ConnexionPage({ searchParams }: { searchParams: Promise<{ suite?: string }> }) {
  const { suite } = await searchParams;
  const next = safeNext(suite);
  if (await getCurrentUser()) redirect(next);
  return (
    <div className="ohm-grille min-h-[70dvh]">
      <div className="mx-auto max-w-xl px-4 py-10 sm:px-6 sm:py-16">
        <LoginNotebook next={next} testMode={serverEnv().OTP_TEST_MODE} />
      </div>
    </div>
  );
}
