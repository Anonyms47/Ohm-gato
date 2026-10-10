import { FooterNav, type FooterGroup } from "@/components/layout/FooterNav";
import { brand } from "@/config/brand";

const GROUPS: FooterGroup[] = [
  {
    title: "Commander",
    links: [
      { href: "/carte", label: "La carte" },
      { href: "/fournees", label: "Nos fournées" },
      { href: "/sur-mesure", label: "Sur-mesure" },
      { href: "/suivi", label: "Suivre ma commande" },
    ],
  },
  {
    title: brand.name,
    links: [
      { href: "/notre-histoire", label: "Notre histoire" },
      { href: "/livraison-retrait", label: "Livraison et retrait" },
      { href: "/allergenes-conservation", label: "Allergènes et conservation" },
      { href: brand.instagramUrl, label: "Instagram", external: true },
      { href: brand.whatsappUrl, label: "WhatsApp", external: true },
    ],
  },
  {
    title: "Informations",
    links: [
      { href: "/conditions-generales", label: "Conditions générales" },
      { href: "/annulation-remboursement", label: "Annulation et remboursement" },
      { href: "/confidentialite", label: "Confidentialité" },
      { href: "/cookies", label: "Cookies" },
      { href: "/mentions-legales", label: "Mentions légales" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="ohm-cacao mt-auto pb-36 print:hidden md:pb-0">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
        <div>
          <p className="font-display text-[1.6rem] leading-none">{brand.name}</p>
          <p className="mt-2 text-creme/80">Pâtisseries faites maison à {brand.city}.</p>
          <p className="mt-4 text-creme/85">
            Retrait : {brand.pickupAddress}, {brand.city}
          </p>
          <p className="mt-2">
            <a href={`tel:${brand.phoneE164}`} className="inline-flex min-h-11 items-center underline decoration-caramel decoration-2 underline-offset-4">
              {brand.phoneDisplay}
            </a>
          </p>
        </div>
        <FooterNav groups={GROUPS} />
      </div>
    </footer>
  );
}
