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
          <p className="flex items-center gap-3 font-display text-[1.6rem] leading-none">
            {/* eslint-disable-next-line @next/next/no-img-element -- petit logo décoratif, sans optimisation d'image */}
            <img src="/brand/logo-ohmegato.png" alt="" width={48} height={48} className="size-12 rounded-full bg-creme" />
            {brand.name}
          </p>
          <p className="mt-2 text-creme/80">Pâtisseries faites maison à {brand.city}.</p>
          <p className="mt-4 text-creme/85">
            Retrait : {brand.pickupAddress}, {brand.city}
          </p>
          <p className="mt-2">
            <a href={`tel:${brand.phoneE164}`} className="inline-flex min-h-11 items-center underline decoration-caramel decoration-2 underline-offset-4">
              {brand.phoneDisplay}
            </a>
          </p>
          <p>
            <a href={`mailto:${brand.email}`} className="inline-flex min-h-11 items-center underline decoration-caramel decoration-2 underline-offset-4">
              {brand.email}
            </a>
          </p>
        </div>
        <FooterNav groups={GROUPS} />
      </div>
      {/* Signature : nom de la marque, exploitante et droits (année à l'heure de Dakar). */}
      <div className="border-t border-creme/15">
        <p className="mx-auto max-w-7xl px-4 py-5 text-[0.9rem] text-creme/75 sm:px-6" data-testid="signature-site">
          © {new Intl.DateTimeFormat("fr-SN", { year: "numeric", timeZone: "Africa/Dakar" }).format(new Date())} {brand.name} · Tous droits réservés · Activité
          individuelle de pâtisserie maison de Madame {brand.operator}, {brand.city}.
        </p>
      </div>
    </footer>
  );
}
