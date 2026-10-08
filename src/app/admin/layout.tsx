import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: { default: "Administration", template: "%s · Admin OHMEGATO" }, robots: { index: false, follow: false } };

/** Accès vérifié côté serveur : le rôle admin est relu en base à chaque requête. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?suite=/admin");
  if (!user.isAdmin) {
    return (
      <main className="ohm-grille grid min-h-dvh place-items-center px-4">
        <div className="max-w-md rounded-[14px] border-2 border-chocolat bg-blanc-casse p-6">
          <h1 className="font-display text-[2rem]">Accès réservé</h1>
          <p className="mt-2">Cet espace est réservé à l&apos;équipe OHMEGATO.</p>
          <Link href="/" className="mt-4 inline-flex min-h-11 items-center font-bold underline decoration-caramel decoration-2 underline-offset-4">
            Revenir au site
          </Link>
        </div>
      </main>
    );
  }
  return <AdminShell name={user.displayName}>{children}</AdminShell>;
}
