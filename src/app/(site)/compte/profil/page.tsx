import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  AddressSection,
  ContactSection,
  DataSection,
  FavoritesSection,
  PreferencesSection,
  SessionsSection,
} from "@/components/account/ProfileSections";
import { getMyAddresses, getMyFavorites, getMyProfile, getMySessions } from "@/lib/account/data";
import { requireUser } from "@/lib/auth/session";
import { getCatalog } from "@/lib/catalog";

export const metadata: Metadata = { title: "Mon profil" };

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-titre`} id={id} className="scroll-mt-24 border-t-2 border-dashed border-chocolat/20 pt-6">
      <h2 id={`${id}-titre`} className="mb-4 font-display text-[1.6rem]">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function ProfilPage() {
  const user = await requireUser("/compte/profil");
  const [profile, addresses, favoriteIds, sessions, { products }] = await Promise.all([
    getMyProfile(user.id),
    getMyAddresses(user.id),
    getMyFavorites(user.id),
    getMySessions(),
    getCatalog(),
  ]);
  const favorites = products.filter((p) => favoriteIds.includes(p.id)).map((p) => ({ id: p.id, name: p.name, slug: p.slug }));
  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <h1 className="font-display text-[1.8rem]">Profil</h1>
      <nav aria-label="Rubriques du profil">
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {[
            ["coordonnees", "Coordonnées"],
            ["adresses", "Adresses et positions"],
            ["preferes", "Produits préférés"],
            ["preferences", "Alertes et consentements"],
            ["sessions", "Sessions"],
            ["donnees", "Mes données"],
          ].map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="inline-flex min-h-11 items-center font-bold underline decoration-caramel decoration-2 underline-offset-4">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <Section id="coordonnees" title="Coordonnées">
        <ContactSection profile={profile} />
      </Section>
      <Section id="adresses" title="Adresses et positions">
        <AddressSection addresses={addresses} />
      </Section>
      <Section id="preferes" title="Produits préférés">
        <FavoritesSection favorites={favorites} />
      </Section>
      <Section id="preferences" title="Alertes et consentements">
        <PreferencesSection profile={profile} />
      </Section>
      <Section id="sessions" title="Sessions">
        <SessionsSection sessions={sessions} />
      </Section>
      <Section id="donnees" title="Mes données">
        <DataSection />
      </Section>
    </div>
  );
}
