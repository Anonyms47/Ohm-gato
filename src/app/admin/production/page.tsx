import { redirect } from "next/navigation";
import { activeCycle } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/auth/session";

/** Raccourci « Fiche de production » de la fournée de travail. */
export default async function ProductionShortcut() {
  await requireAdmin();
  const cycle = await activeCycle();
  redirect(cycle ? `/admin/fournees/${cycle.id}/production` : "/admin/fournees");
}
