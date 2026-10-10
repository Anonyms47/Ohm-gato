"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createProduct, deleteProductImage, saveFlavors, saveVariant, updateProduct, uploadProductImage } from "@/app/admin/_actions/products";
import { ActionButton, AdminForm, StateMessage } from "@/components/admin/AdminUi";
import { Button } from "@/components/ui/Button";
import { Field, TextArea, TextInput } from "@/components/ui/Field";
import { OhmegatoCombobox, OhmegatoMultiSelect } from "@/components/ui/select/OhmegatoCombobox";
import { OhmegatoSelect } from "@/components/ui/select/OhmegatoSelect";
import type { AdminProduct } from "@/lib/admin/data";
import type { AdminState } from "@/lib/admin/errors";
import { storageText } from "@/lib/storage";

export function NewProductForm() {
  return (
    <AdminForm action={createProduct} submitLabel="Créer le produit (non publié)">
      <Field label="Nom du produit">{({ id }) => <TextInput id={id} name="name" required maxLength={80} />}</Field>
    </AdminForm>
  );
}

const CATEGORIES = ["biscuits", "gateaux", "choux", "verrines", "patisserie"];

export function ProductForm({ product, categories }: { product: AdminProduct; categories: string[] }) {
  const [category, setCategory] = useState(product.category);
  const [accent, setAccent] = useState(product.accent);
  const [storageRule, setStorageRule] = useState(product.storageRule ?? "");
  const allCategories = [...new Set([...CATEGORIES, ...categories, category])];
  return (
    <AdminForm action={updateProduct} submitLabel="Enregistrer le produit">
      <input type="hidden" name="id" value={product.id} />
      <input type="hidden" name="category" value={category} />
      <input type="hidden" name="accent" value={accent} />
      <input type="hidden" name="storageRule" value={storageRule} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom">{({ id }) => <TextInput id={id} name="name" required defaultValue={product.name} />}</Field>
        <OhmegatoCombobox
          label="Catégorie"
          value={category}
          onValueChange={setCategory}
          options={allCategories.map((c) => ({ value: c, label: c }))}
          searchPlaceholder="Rechercher une catégorie"
        />
      </div>
      <Field label="Description courte" hint="Cartes et listes.">
        {({ id }) => <TextInput id={id} name="shortDescription" maxLength={200} defaultValue={product.shortDescription} />}
      </Field>
      <Field label="Description">{({ id }) => <TextArea id={id} name="description" rows={4} maxLength={2000} defaultValue={product.description} />}</Field>
      <Field label="Conseil de dégustation" optional hint="Uniquement des conseils confirmés par OHMEGATO.">
        {({ id }) => <TextArea id={id} name="tips" rows={2} maxLength={500} defaultValue={product.tips ?? ""} />}
      </Field>
      <fieldset className="grid gap-4 rounded-[12px] border-2 border-chocolat/20 p-4 sm:grid-cols-2">
        <legend className="px-1 font-bold">Unités de stock</legend>
        <p className="text-encre-douce sm:col-span-2">
          Le stock se compte en unités réelles. Chaque format consomme un nombre d&apos;unités (ex. box de 6 = 6 {product.unitLabelPlural}).
        </p>
        <Field label="Unité (singulier)">{({ id }) => <TextInput id={id} name="unitLabel" required defaultValue={product.unitLabel} />}</Field>
        <Field label="Unité (pluriel)">{({ id }) => <TextInput id={id} name="unitLabelPlural" required defaultValue={product.unitLabelPlural} />}</Field>
      </fieldset>
      <fieldset className="flex min-w-0 flex-col gap-4 rounded-[12px] border-2 border-chocolat/20 p-4">
        <legend className="px-1 font-bold">Conservation</legend>
        <OhmegatoSelect
          label="Règle"
          value={storageRule || "none"}
          onValueChange={(v) => setStorageRule(v === "none" ? "" : v)}
          options={[
            { value: "none", label: "Non renseignée (rien n'est affiché)" },
            ...Object.entries(storageText).map(([value, label]) => ({ value, label })),
          ]}
        />
        <Field label="Précision" optional>
          {({ id }) => <TextInput id={id} name="storageNote" maxLength={300} defaultValue={product.storageNote ?? ""} />}
        </Field>
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" name="storageConfirmed" className="size-5 accent-[var(--ohm-chocolat)]" defaultChecked={product.storageConfirmed} />
          Règle confirmée par OHMEGATO (affichée aux clients)
        </label>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <OhmegatoSelect
          label="Couleur d'accent"
          value={accent}
          onValueChange={setAccent}
          options={[
            { value: "caramel", label: "Caramel" },
            { value: "chocolate", label: "Chocolat" },
            { value: "orange", label: "Orange" },
            { value: "rose", label: "Rose" },
          ]}
        />
        <Field label="Ordre d'affichage">{({ id }) => <TextInput id={id} name="sortOrder" type="number" defaultValue={product.sortOrder} />}</Field>
      </div>
      <label className="flex min-h-11 items-center gap-3 font-bold">
        <input type="checkbox" name="isActive" className="size-5 accent-[var(--ohm-chocolat)]" defaultChecked={product.isActive} />
        Publié sur la carte
      </label>
    </AdminForm>
  );
}

export function VariantsEditor({ product }: { product: AdminProduct }) {
  return (
    <div className="flex flex-col gap-3">
      {[...product.variants, null].map((v) => (
        <details key={v?.id ?? "new"} className="rounded-[12px] border-2 border-chocolat/20 bg-blanc-casse p-4" open={!v && product.variants.length === 0}>
          <summary className="min-h-11 cursor-pointer font-bold">
            {v ? `${v.label} · ${v.unitsConsumed} u. · ${v.priceFcfa} FCFA${v.isActive ? "" : " (désactivé)"}` : "Ajouter un format"}
          </summary>
          <AdminForm action={saveVariant} submitLabel={v ? "Enregistrer le format" : "Ajouter le format"} className="mt-3">
            <input type="hidden" name="productId" value={product.id} />
            <input type="hidden" name="id" value={v?.id ?? ""} />
            <div className="grid gap-4 sm:grid-cols-4">
              <Field label="Format">{({ id }) => <TextInput id={id} name="label" required defaultValue={v?.label ?? ""} placeholder="Box de 6" />}</Field>
              <Field label="Unités consommées">{({ id }) => <TextInput id={id} name="unitsConsumed" type="number" min={1} required defaultValue={v?.unitsConsumed ?? 1} />}</Field>
              <Field label="Prix (FCFA)">{({ id }) => <TextInput id={id} name="priceFcfa" type="number" min={0} step={50} required defaultValue={v?.priceFcfa ?? ""} />}</Field>
              <Field label="Ordre">{({ id }) => <TextInput id={id} name="sortOrder" type="number" defaultValue={v?.sortOrder ?? product.variants.length + 1} />}</Field>
            </div>
            <label className="flex min-h-11 items-center gap-3">
              <input type="checkbox" name="isActive" className="size-5 accent-[var(--ohm-chocolat)]" defaultChecked={v?.isActive ?? true} />
              Format actif
            </label>
          </AdminForm>
        </details>
      ))}
    </div>
  );
}

export function FlavorsEditor({ product, flavors }: { product: AdminProduct; flavors: { id: string; name: string }[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState(product.flavorIds);
  const [newFlavor, setNewFlavor] = useState("");
  const [state, setState] = useState<AdminState>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <OhmegatoMultiSelect label="Parfums proposés" values={selected} onValuesChange={setSelected} options={flavors.map((f) => ({ value: f.id, label: f.name }))} placeholder="Sans parfum" />
      <Field label="Nouveau parfum" optional>
        {({ id }) => <TextInput id={id} value={newFlavor} onChange={(e) => setNewFlavor(e.target.value)} maxLength={40} />}
      </Field>
      <StateMessage state={state} />
      <Button
        variant="secondary"
        className="self-start"
        state={busy ? "loading" : "idle"}
        onClick={async () => {
          setBusy(true);
          const result = await saveFlavors(product.id, selected, newFlavor);
          setBusy(false);
          setState(result);
          if (result?.ok) {
            setNewFlavor("");
            router.refresh();
          }
        }}
      >
        Enregistrer les parfums
      </Button>
    </div>
  );
}

export function ImagesEditor({ product, imageUrl }: { product: AdminProduct; imageUrl: Record<string, string> }) {
  const [role, setRole] = useState("cutout");
  return (
    <div className="flex flex-col gap-4">
      {product.images.length === 0 ? (
        <p className="text-encre-douce">Aucune photo : le produit s&apos;affiche avec un cercle de couleur, sans image inventée.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {product.images.map((img) => (
            <li key={img.id} className="flex flex-col gap-2 rounded-[12px] bg-blanc-casse p-3">
              <Image src={imageUrl[img.id]!} alt={img.alt} width={img.width} height={img.height} className="h-40 w-full object-contain" unoptimized />
              <p className="text-[0.95rem]">{img.alt}</p>
              <ActionButton
                label="Supprimer la photo"
                variant="text"
                run={() => deleteProductImage(img.id, product.id)}
                confirm={{ title: "Supprimer cette photo ?", description: <p>{img.alt}</p>, destructive: true }}
              />
            </li>
          ))}
        </ul>
      )}
      <AdminForm action={uploadProductImage} submitLabel="Ajouter la photo" className="rounded-[12px] border-2 border-dashed border-chocolat/30 p-4">
        <input type="hidden" name="productId" value={product.id} />
        <input type="hidden" name="role" value={role} />
        <Field label="Photo réelle du produit" hint="WebP, PNG ou JPEG, 5 Mo maximum.">
          {({ id }) => <input id={id} name="file" type="file" required accept="image/webp,image/png,image/jpeg" className="min-h-11" />}
        </Field>
        <Field label="Description de la photo (texte alternatif)">{({ id }) => <TextInput id={id} name="alt" required maxLength={200} />}</Field>
        <OhmegatoSelect
          label="Usage"
          value={role}
          onValueChange={setRole}
          options={[
            { value: "cutout", label: "Détourée (fiches et cartes)" },
            { value: "scene", label: "Mise en scène" },
            { value: "detail", label: "Détail" },
          ]}
        />
      </AdminForm>
    </div>
  );
}
