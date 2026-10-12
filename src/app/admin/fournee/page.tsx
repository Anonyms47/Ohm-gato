import { redirect } from "next/navigation";
import { activeCycle } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/auth/session";

/** Raccourci « Fournée » : ouvre la fournée de travail, ou la liste s'il n'y en a pas. */
export default async function ActiveCycleShortcut() {
  await requireAdmin();
  const cycle = await activeCycle();
  redirect(cycle ? `/admin/fournees/${cycle.id}` : "/admin/fournees");
}
