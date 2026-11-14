import { brand } from "@/config/brand";

/** En-tête des pages imprimées : logo OHMEGATO et coordonnées (invisible à l'écran). */
export function PrintLogo() {
  return (
    <div aria-hidden className="mb-6 hidden items-center gap-4 border-b-2 border-chocolat/20 pb-4 print:flex">
      {/* eslint-disable-next-line @next/next/no-img-element -- logo imprimé tel quel, sans optimisation d'image */}
      <img src={brand.logotype.png} alt="" width={180} height={60} className="h-auto w-44" />
      <div>
        <p className="text-[0.85rem] text-encre-douce">
          Pâtisseries faites maison à {brand.city} · {brand.phoneDisplay} · ohmegato.com
        </p>
      </div>
    </div>
  );
}
