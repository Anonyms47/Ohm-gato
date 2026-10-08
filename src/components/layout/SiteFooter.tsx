import { brand } from "@/config/brand";

export function SiteFooter() {
  return (
    <footer className="ohm-cacao mt-auto pb-36 md:pb-0">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-3 sm:px-6">
        <div>
          <p className="font-display text-[1.6rem] leading-none">{brand.name}</p>
          <p className="mt-2 text-creme/80">Pâtisseries faites maison à {brand.city}.</p>
        </div>
        <div>
          <h2 className="font-bold">Nous écrire</h2>
          <ul className="mt-2 space-y-1">
            <li>
              <a href={brand.whatsappUrl} className="inline-flex min-h-11 items-center underline decoration-caramel decoration-2 underline-offset-4">
                WhatsApp {brand.phoneDisplay}
              </a>
            </li>
            <li>
              <a href={`tel:${brand.phoneE164}`} className="inline-flex min-h-11 items-center underline decoration-caramel decoration-2 underline-offset-4">
                Appeler
              </a>
            </li>
            <li>
              <a href={brand.instagramUrl} className="inline-flex min-h-11 items-center underline decoration-caramel decoration-2 underline-offset-4">
                Instagram @{brand.instagramHandle}
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="font-bold">Retrait</h2>
          <p className="mt-2 text-creme/85">{brand.pickupAddress}</p>
        </div>
      </div>
    </footer>
  );
}
