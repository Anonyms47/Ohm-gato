import Link from "next/link";
import { OrderBoard, type BoardGroup, type BoardOrder } from "@/components/admin/OrderBoard";
import { QueryFilters } from "@/components/admin/OrderFilters";
import { ORDERS_PAGE_SIZE, listCycles, listOrders, type AdminOrderRow } from "@/lib/admin/data";
import { STAGES, orderStage } from "@/lib/admin/order-stage";
import { requireAdmin } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { formatDay } from "@/lib/dates";

export const metadata = { title: "Commandes" };

type View = "besoin" | "creneau" | "liste";

const VIEWS: { key: View; label: string; hint: string }[] = [
  { key: "besoin", label: "Par besoin", hint: "Regroupées par ce qu'il reste à faire." },
  { key: "creneau", label: "Par créneau", hint: "Dans l'ordre des livraisons et retraits." },
  { key: "liste", label: "Liste", hint: "Toutes les commandes, avec filtres." },
];

const toBoard = (o: AdminOrderRow): BoardOrder => ({ ...o });

const ACTIVE_STAGES = new Set(["a-verifier", "payees", "a-preparer", "prete", "a-remettre"]);

export default async function AdminCommandes({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const filtered = Boolean(sp.q || sp.statut || sp.etape || sp.paiement || sp.mode || sp.fournee || sp.jour);
  const view: View = sp.vue === "besoin" || sp.vue === "creneau" || sp.vue === "liste" ? sp.vue : filtered ? "liste" : "besoin";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const [rows, cycles] = await Promise.all([
    view === "liste"
      ? listOrders({ q: sp.q, status: sp.statut, stage: sp.etape, payment: sp.paiement, fulfillment: sp.mode, cycle: sp.fournee, today: sp.jour === "aujourdhui", page })
      : listOrders({ cycle: sp.fournee }),
    listCycles(),
  ]);

  let groups: BoardGroup[];
  let hasMore = false;
  if (view === "liste") {
    hasMore = rows.length > ORDERS_PAGE_SIZE;
    groups = [{ key: "liste", label: "Commandes", orders: rows.slice(0, ORDERS_PAGE_SIZE).map(toBoard) }];
  } else if (view === "besoin") {
    groups = STAGES.map((s) => ({
      key: s.key,
      label: s.label,
      hint: s.hint,
      // Les commandes terminées ou annulées : seulement les plus récentes, la liste complète reste en vue « Liste ».
      orders: rows
        .filter((o) => orderStage(o.status, o.paymentStatus) === s.key)
        .slice(0, ACTIVE_STAGES.has(s.key) ? undefined : 12)
        .map(toBoard),
    })).filter((g) => g.orders.length > 0 || ACTIVE_STAGES.has(g.key));
  } else {
    const active = rows.filter((o) => ACTIVE_STAGES.has(orderStage(o.status, o.paymentStatus)));
    const byDay = new Map<string, AdminOrderRow[]>();
    for (const o of [...active].sort((a, b) => (a.slotStartsAt ?? "9999").localeCompare(b.slotStartsAt ?? "9999"))) {
      const day = o.slotStartsAt ? o.slotStartsAt.slice(0, 10) : "sans-creneau";
      byDay.set(day, [...(byDay.get(day) ?? []), o]);
    }
    groups = [...byDay.entries()].map(([day, orders]) => ({
      key: `jour-${day}`,
      label: day === "sans-creneau" ? "Sans créneau choisi" : formatDay(day),
      orders: orders.map(toBoard),
    }));
  }

  const query = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) next.set(k, v);
    return `/admin/commandes?${next.toString()}`;
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-[clamp(1.8rem,4vw,2.4rem)]">Commandes</h1>
        <nav aria-label="Vues des commandes" className="flex flex-wrap gap-2">
          {VIEWS.map((v) => (
            <Link
              key={v.key}
              href={v.key === "liste" ? query({ vue: "liste", page: undefined }) : `/admin/commandes?vue=${v.key}${sp.fournee ? `&fournee=${sp.fournee}` : ""}`}
              aria-current={view === v.key ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full border-2 px-4 font-bold",
                view === v.key ? "border-chocolat bg-chocolat text-creme" : "border-chocolat/30 bg-blanc-casse hover:border-chocolat",
              )}
            >
              {v.label}
            </Link>
          ))}
        </nav>
        <p className="text-encre-douce">{VIEWS.find((v) => v.key === view)!.hint} Cochez des commandes pour les faire avancer ensemble.</p>
      </header>

      {view === "liste" && (
        <QueryFilters
          collapsible
          filters={[
            { name: "etape", label: "Étape", options: STAGES.map((s) => ({ value: s.key, label: s.label })) },
            { name: "paiement", label: "Paiement", options: [{ value: "pending", label: "À vérifier" }, { value: "paid", label: "Payée" }, { value: "refunded", label: "Remboursée" }] },
            { name: "mode", label: "Réception", options: [{ value: "delivery", label: "Livraison" }, { value: "pickup", label: "Retrait" }] },
            { name: "fournee", label: "Fournée", options: cycles.map((c) => ({ value: c.id, label: `n°${c.number}` })) },
          ]}
        />
      )}

      {rows.length === 0 ? (
        <p className="atelier-ticket p-5 text-[1.05rem]">
          {filtered ? "Aucune commande ne correspond à ces filtres." : "La première commande n'est pas encore arrivée. Elle apparaîtra ici dès qu'une cliente validera sa boîte."}
        </p>
      ) : (
        <OrderBoard groups={groups} dense={view === "liste"} />
      )}

      {view === "liste" && (page > 1 || hasMore) && (
        <nav aria-label="Pages" className="flex items-center justify-between gap-3">
          {page > 1 ? (
            <Link href={query({ page: String(page - 1) })} className="inline-flex min-h-11 items-center font-bold underline decoration-caramel decoration-2 underline-offset-4">
              ← Plus récentes
            </Link>
          ) : (
            <span />
          )}
          <span className="text-encre-douce">Page {page}</span>
          {hasMore ? (
            <Link href={query({ page: String(page + 1) })} className="inline-flex min-h-11 items-center font-bold underline decoration-caramel decoration-2 underline-offset-4">
              Plus anciennes →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
