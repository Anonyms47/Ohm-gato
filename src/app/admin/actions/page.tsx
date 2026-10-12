import type { Metadata } from "next";
import { TaskList } from "@/components/admin/TodayParts";
import { loadToday } from "@/lib/admin/today";
import { requireAdmin } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Actions à traiter" };

export default async function AdminActions() {
  await requireAdmin();
  const d = await loadToday();
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header>
        <h1 className="font-display text-[clamp(1.8rem,4vw,2.4rem)]">Actions à traiter</h1>
        <p className="text-encre-douce">Recalculées à chaque visite à partir des commandes, paiements et fournées réels. Les plus urgentes d&apos;abord.</p>
      </header>
      <TaskList tasks={d.tasks} emptyText="Aucune action n'attend pour le moment." />
    </div>
  );
}
