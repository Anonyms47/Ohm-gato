import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CustomRequestDetail } from "@/components/custom/CustomRequestDetail";
import { getCurrentUser } from "@/lib/auth/session";
import { getCustomRequestByToken } from "@/lib/custom/data";
import { ownedReferences } from "@/lib/orders/owner-cookie";

export const metadata: Metadata = { title: "Ma demande sur-mesure", robots: { index: false, follow: false } };

export default async function CustomRequestTrackingPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ envoyee?: string }>;
}) {
  const [{ token }, { envoyee }] = await Promise.all([params, searchParams]);
  const request = await getCustomRequestByToken(token);
  if (!request) notFound();
  const [owned, user] = await Promise.all([ownedReferences("demandes"), getCurrentUser()]);
  const limited = !owned.includes(request.reference) && !(user && (user.id === request.userId || user.isAdmin));
  return (
    <div className="ohm-grille">
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
        <CustomRequestDetail request={request} access={{ token }} justSent={envoyee === "1"} limited={limited} />
      </div>
    </div>
  );
}
