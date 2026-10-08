import type { Metadata } from "next";
import type { ReactNode } from "react";
import { MemberTabs } from "@/components/account/MemberNav";
import { signOut } from "@/app/(site)/compte/actions";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: { default: "Mon carnet", template: "%s · Mon carnet OHMEGATO" }, robots: { index: false } };

export default async function CompteLayout({ children }: { children: ReactNode }) {
  const user = await requireUser("/compte");
  return (
    <div className="ohm-grille min-h-[70dvh]">
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-script text-[1.3rem] text-caramel-encre">mon carnet OHMEGATO</p>
            <p className="font-display text-[clamp(1.6rem,4.5vw,2.2rem)] leading-tight">Bonjour {user.displayName}</p>
          </div>
          <form action={signOut}>
            <button type="submit" className="min-h-11 font-bold underline decoration-caramel decoration-2 underline-offset-4">
              Se déconnecter
            </button>
          </form>
        </div>
        <div className="mt-5">
          <MemberTabs />
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
