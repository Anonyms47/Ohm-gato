"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { AdminState } from "@/lib/admin/errors";
import { requireAdmin } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

const statusSchema = z.enum(["contains", "may_contain", "no_added", "not_confirmed", "not_applicable"]);
const verificationSchema = z.enum(["confirmed_by_alima", "deduced_from_recipe", "packaging_check_needed"]);
const uuid = z.uuid();

const payloadSchema = z.object({
  statuses: z
    .array(
      z.object({
        flavorId: uuid.nullable(),
        allergenId: uuid,
        status: statusSchema,
        note: z.string().trim().max(300),
        verification: verificationSchema,
        verifiedAt: z.iso.datetime({ offset: true }).nullable(),
      }),
    )
    .max(200),
  recipeNotes: z
    .array(
      z.object({
        flavorId: uuid.nullable(),
        label: z.string().trim().min(2).max(80),
        verification: verificationSchema,
        verifiedAt: z.iso.datetime({ offset: true }).nullable(),
      }),
    )
    .max(60),
});

export type AllergenPayload = z.input<typeof payloadSchema>;

/** Remplace les allergènes et informations de recette d'un produit (tous parfums compris). */
export async function saveAllergenInfo(productId: string, input: AllergenPayload): Promise<AdminState> {
  const admin = await requireAdmin();
  if (!uuid.safeParse(productId).success) return { ok: false, message: "Produit introuvable." };
  const parsed = payloadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Vérifiez les lignes : une information de recette compte 2 à 80 caractères." };
  const { statuses, recipeNotes } = parsed.data;

  const scopeKey = (s: { flavorId: string | null; allergenId: string }) => `${s.flavorId ?? "-"}:${s.allergenId}`;
  if (new Set(statuses.map(scopeKey)).size !== statuses.length) {
    return { ok: false, message: "Un même allergène apparaît deux fois pour le même parfum." };
  }

  const db = supabaseAdmin();
  const { data: flavors, error: flavorError } = await db.from("product_flavors").select("flavor_id").eq("product_id", productId);
  if (flavorError) return { ok: false, message: "Enregistrement impossible." };
  const allowed = new Set((flavors as { flavor_id: string }[]).map((f) => f.flavor_id));
  if ([...statuses, ...recipeNotes].some((r) => r.flavorId !== null && !allowed.has(r.flavorId))) {
    return { ok: false, message: "Un parfum ne fait plus partie de ce produit. Rechargez la page." };
  }

  const statusRows = statuses.map((s) => ({
    product_id: productId,
    flavor_id: s.flavorId,
    allergen_id: s.allergenId,
    status: s.status,
    note: s.note || null,
    verification: s.verification,
    verified_at: s.verifiedAt,
  }));
  const noteRows = recipeNotes.map((n, index) => ({
    product_id: productId,
    flavor_id: n.flavorId,
    label: n.label,
    sort_order: index + 1,
    verification: n.verification,
    verified_at: n.verifiedAt,
  }));
  const failed = { ok: false as const, message: "Enregistrement impossible : les informations précédentes ont été conservées." };

  // Copie de sécurité : en cas d'échec d'écriture, les valeurs précédentes sont remises.
  const statusCols = "product_id, flavor_id, allergen_id, status, note, verification, verified_at";
  const noteCols = "product_id, flavor_id, label, sort_order, verification, verified_at";
  const [oldStatuses, oldNotes] = await Promise.all([
    db.from("product_allergen_statuses").select(statusCols).eq("product_id", productId),
    db.from("product_recipe_notes").select(`id, ${noteCols}`).eq("product_id", productId),
  ]);
  if (oldStatuses.error || oldNotes.error) return failed;

  const replaceStatuses = async (rows: Record<string, unknown>[]) => {
    const removed = await db.from("product_allergen_statuses").delete().eq("product_id", productId);
    if (removed.error) return false;
    return rows.length === 0 || !(await db.from("product_allergen_statuses").insert(rows)).error;
  };
  if (!(await replaceStatuses(statusRows))) {
    await replaceStatuses(oldStatuses.data as Record<string, unknown>[]);
    return failed;
  }
  // Informations de recette : les nouvelles d'abord, puis retrait des anciennes (rien n'est perdu entre les deux).
  if (noteRows.length > 0 && (await db.from("product_recipe_notes").insert(noteRows)).error) {
    await replaceStatuses(oldStatuses.data as Record<string, unknown>[]);
    return failed;
  }
  const oldNoteIds = (oldNotes.data as { id: string }[]).map((n) => n.id);
  if (oldNoteIds.length > 0) await db.from("product_recipe_notes").delete().in("id", oldNoteIds);

  await db.rpc("write_audit", {
    p_actor: admin.id,
    p_action: "product.allergens",
    p_entity: "products",
    p_entity_id: productId,
    p_details: { statuses: statuses.length, recipeNotes: recipeNotes.length },
  });
  revalidatePath(`/admin/produits/${productId}`);
  revalidatePath("/", "layout");
  return { ok: true, message: "Allergènes enregistrés. L'aperçu correspond à ce que voient les clients." };
}

const workshopSchema = z.object({
  enabled: z.boolean(),
  allergens: z.array(z.string().regex(/^[a-z-]+$/)).max(20),
  review: z.object({ ingredients: z.boolean(), packaging: z.boolean(), utensils: z.boolean() }),
});

/**
 * Traces d'atelier : la mention ne peut être activée que si Alima a confirmé les ingrédients
 * manipulés, les emballages et les ustensiles ou surfaces partagés.
 */
export async function saveWorkshopTraces(input: z.input<typeof workshopSchema>): Promise<AdminState> {
  const admin = await requireAdmin();
  const parsed = workshopSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Données invalides." };
  const { enabled, allergens, review } = parsed.data;
  const reviewed = review.ingredients && review.packaging && review.utensils;
  if (enabled && !reviewed) {
    return { ok: false, message: "Cochez les trois vérifications avant d'activer la mention de traces." };
  }
  if (enabled && allergens.length === 0) return { ok: false, message: "Choisissez au moins un allergène." };

  const db = supabaseAdmin();
  const { error } = await db.from("site_settings").upsert([
    { key: "allergens.workshop_traces", value: { enabled, allergens }, is_public: true },
    {
      key: "allergens.workshop_traces_review",
      value: { ...review, confirmed_at: reviewed ? new Date().toISOString() : null },
      is_public: false,
    },
  ]);
  if (error) return { ok: false, message: "Enregistrement impossible." };
  await db.rpc("write_audit", {
    p_actor: admin.id,
    p_action: "settings.workshop_traces",
    p_entity: "site_settings",
    p_entity_id: "allergens.workshop_traces",
    p_details: { enabled, allergens },
  });
  revalidatePath("/admin/reglages");
  revalidatePath("/", "layout");
  return { ok: true, message: enabled ? "Mention de traces activée sur les fiches." : "Mention de traces désactivée." };
}
