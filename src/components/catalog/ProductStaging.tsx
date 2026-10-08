import { Annotation } from "@/components/brand/BrandHeading";
import type { CatalogProduct } from "@/lib/catalog-types";

/**
 * « Coupe gourmande » : chaque fiche a sa propre mise en scène, construite
 * uniquement à partir de la description réelle du produit.
 */
const notes: Record<string, string[]> = {
  "cookie-casse": ["bords croustillants", "cœur moelleux", "chocolat noir et au lait concassés", "note caramélisée"],
  "brownies-empiles": ["petits carrés", "très chocolatés", "sans lait ajouté"],
  "sauce-moelleux": ["sauce chocolat servie dessus", "pépites", "gâteau au chocolat"],
  "muffin-origine": ["pépites de chocolat", "légère note de cannelle", "le tout premier gâteau OHMEGATO"],
  "coupe-pommes": ["lamelles de pommes caramélisées au fond", "cannelle", "gâteau aux pommes"],
  "cake-tranches": ["barre rectangulaire", "base gâteau au yaourt", "véritable goût d'orange"],
  "choux-pyramide": ["pâte à choux", "crème pâtissière"],
};

function VerrineLayers() {
  // Coupe réelle de la verrine : 2 × (crème, génoise, coulis), du fond vers le haut.
  const layers = [
    { name: "Coulis ou marmelade", className: "bg-orange" },
    { name: "Génoise", className: "bg-caramel" },
    { name: "Crème", className: "bg-blanc-casse" },
    { name: "Coulis ou marmelade", className: "bg-orange" },
    { name: "Génoise", className: "bg-caramel" },
    { name: "Crème", className: "bg-blanc-casse" },
  ];
  return (
    <figure className="flex items-center gap-6">
      <div aria-hidden className="flex h-64 w-28 flex-col-reverse overflow-hidden rounded-b-[28px] rounded-t-[6px] border-[3px] border-chocolat">
        {layers.map((layer, i) => (
          <div key={i} className={`flex-1 border-t border-chocolat/25 ${layer.className}`} />
        ))}
      </div>
      <figcaption>
        <ol className="flex flex-col-reverse gap-1.5">
          {layers.map((layer, i) => (
            <li key={i} className="font-script text-[1.3rem] leading-tight text-caramel-encre">
              {i + 1}. {layer.name}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[0.95rem] text-encre-douce">De bas en haut.</p>
      </figcaption>
    </figure>
  );
}

export function ProductStaging({ product }: { product: CatalogProduct }) {
  if (product.staging === "verrine-couches") return <VerrineLayers />;
  const list = notes[product.staging] ?? [];
  if (list.length === 0) return null;
  return (
    <ul className="flex flex-col gap-3">
      {list.map((note, i) => (
        <li key={note} className="flex items-baseline gap-3" style={{ marginLeft: `${(i % 3) * 1.25}rem` }}>
          <span aria-hidden className="size-3 shrink-0 translate-y-[-2px] rounded-full bg-caramel" />
          <Annotation className="text-[1.5rem]">{note}</Annotation>
        </li>
      ))}
    </ul>
  );
}
