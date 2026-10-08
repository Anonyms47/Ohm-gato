import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CustomRequestDetail } from "@/components/custom/CustomRequestDetail";
import { requireUser } from "@/lib/auth/session";
import { getMyCustomRequest } from "@/lib/custom/data";

export const metadata: Metadata = { title: "Ma demande sur-mesure" };

export default async function MaDemande({ params, searchParams }: { params: Promise<{ reference: string }>; searchParams: Promise<{ envoyee?: string }> }) {
  const [{ reference }, { envoyee }] = await Promise.all([params, searchParams]);
  await requireUser(`/compte/sur-mesure/${reference}`);
  const request = await getMyCustomRequest(decodeURIComponent(reference));
  if (!request) notFound();
  return <CustomRequestDetail request={request} access={{ reference: request.reference }} justSent={envoyee === "1"} />;
}
