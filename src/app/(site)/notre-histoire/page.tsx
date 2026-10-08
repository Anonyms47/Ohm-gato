import type { Metadata } from "next";
import Image from "next/image";
import { Annotation, BrandHeading } from "@/components/brand/BrandHeading";
import { TypoTransformation } from "@/components/story/TypoTransformation";
import { ButtonLink } from "@/components/ui/Button";
import { getPublicSettings } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Notre histoire",
  description: "D'Oumy Gâteau à OHMEGATO : les premiers muffins d'Alima à l'ESP, puis une carte qui grandit, et l'envie d'un futur café.",
};

interface StoryPhoto {
  url: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
}

function asPhotos(value: unknown): StoryPhoto[] {
  return Array.isArray(value) ? (value as StoryPhoto[]).filter((p) => p && typeof p.url === "string" && typeof p.alt === "string") : [];
}

const CAFE = ["du café", "des pâtisseries et des desserts", "des livres", "des espaces pour travailler", "des rencontres", "du partage de compétences", "des ateliers culinaires"];

export default async function NotreHistoirePage() {
  const settings = await getPublicSettings();
  const archives = asPhotos(settings["story.archive_photos"]);
  const alimaPhoto = asPhotos([settings["story.alima_photo"]])[0] ?? null;
  const quote = typeof settings["story.quote"] === "string" && settings["story.quote"] ? (settings["story.quote"] as string) : null;
  const audio =
    settings["story.audio"] && typeof (settings["story.audio"] as { url?: unknown }).url === "string"
      ? (settings["story.audio"] as { url: string; transcript?: string })
      : null;

  return (
    <article>
      <header className="ohm-grille">
        <div className="mx-auto max-w-4xl px-4 pb-12 pt-10 text-center sm:px-6 sm:pt-16">
          <Annotation>notre histoire</Annotation>
          <BrandHeading as="h1" size="titre" className="mt-2">
            Un nom qui a grandi
          </BrandHeading>
          <div className="mt-10">
            <TypoTransformation />
          </div>
        </div>
      </header>

      <section aria-labelledby="debut" className="bg-blanc-casse">
        <div className="mx-auto grid max-w-5xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1fr_1.2fr] md:items-center">
          <div>
            <p className="font-script text-[2rem] text-caramel-encre">Oumy Gâteau</p>
            <h2 id="debut" className="font-display text-[clamp(1.8rem,4.5vw,2.6rem)] leading-[1.05]">
              Au commencement, il y avait Oumy Gâteau.
            </h2>
          </div>
          <div className="flex flex-col gap-4 text-[1.1rem]">
            <p>
              Avant OHMEGATO, il y avait « Oumy Gâteau ». Le nom s&apos;est transformé : prononcé d&apos;une traite, il est devenu{" "}
              <strong>OHMEGATO</strong>.
            </p>
            <p>
              Dans OHMEGATO, on entend aussi <strong>Oméga</strong>, la lettre grecque <span aria-hidden>Ω</span>
              <span className="sr-only">oméga</span>, devenue notre signe.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="esp" className="ohm-grille">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
          <h2 id="esp" className="font-display text-[clamp(1.8rem,4.5vw,2.6rem)] leading-[1.05]">
            Les premiers muffins, à l&apos;ESP
          </h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            <li className="rounded-[12px] border-2 border-chocolat bg-blanc-casse p-5 md:-rotate-1">
              <p className="font-script text-[1.5rem] text-caramel-encre">1.</p>
              <p className="text-[1.1rem]">Pendant sa troisième année à l&apos;ESP, Alima prépare ses premiers muffins.</p>
            </li>
            <li className="rounded-[12px] border-2 border-chocolat bg-blanc-casse p-5 md:translate-y-4">
              <p className="font-script text-[1.5rem] text-caramel-encre">2.</p>
              <p className="text-[1.1rem]">Lors d&apos;un événement étudiant, ils rencontrent un vrai succès.</p>
            </li>
            <li className="rounded-[12px] border-2 border-chocolat bg-blanc-casse p-5 md:rotate-1">
              <p className="font-script text-[1.5rem] text-caramel-encre">3.</p>
              <p className="text-[1.1rem]">Viennent ensuite les essais auprès de l&apos;entourage, puis une carte qui s&apos;élargit.</p>
            </li>
          </ol>

          {archives.length > 0 && (
            <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {archives.map((photo) => (
                <li key={photo.url}>
                  <figure className="rotate-[-0.8deg] bg-blanc-casse p-3 shadow-[0_3px_0_var(--ohm-grille)]">
                    <Image src={photo.url} alt={photo.alt} width={photo.width ?? 800} height={photo.height ?? 600} className="h-auto w-full" sizes="(min-width: 1024px) 30vw, 90vw" />
                    {photo.caption && <figcaption className="mt-2 font-script text-[1.2rem] text-caramel-encre">{photo.caption}</figcaption>}
                  </figure>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section aria-labelledby="ondes" className="ohm-cacao">
        <div className="mx-auto grid max-w-5xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 md:items-center">
          <div className="flex flex-col gap-4">
            <h2 id="ondes" className="font-display text-[clamp(1.8rem,4.5vw,2.6rem)] leading-[1.05] text-creme">
              De bonnes ondes et de beaux moments
            </h2>
            <p className="text-[1.1rem] text-creme/90">
              C&apos;est ce qu&apos;OHMEGATO veut partager, une boîte après l&apos;autre : de bonnes ondes et de beaux moments.
            </p>
            {quote && (
              <blockquote className="mt-2 border-l-4 border-caramel pl-4">
                <p className="font-script text-[1.6rem] leading-snug text-creme">{quote}</p>
                <footer className="mt-2 font-bold text-creme/80">— Alima</footer>
              </blockquote>
            )}
            {audio && (
              <figure className="mt-2">
                <figcaption className="mb-2 font-bold text-creme">Alima raconte (audio)</figcaption>
                {/* Jamais de lecture automatique. */}
                <audio controls preload="none" src={audio.url} className="w-full" />
                {audio.transcript && (
                  <details className="mt-2 text-creme/85">
                    <summary className="min-h-11 cursor-pointer font-bold">Lire la transcription</summary>
                    <p className="mt-2 whitespace-pre-line">{audio.transcript}</p>
                  </details>
                )}
              </figure>
            )}
          </div>
          {alimaPhoto && (
            <figure className="mx-auto w-full max-w-sm rotate-1 bg-creme p-3">
              <Image src={alimaPhoto.url} alt={alimaPhoto.alt} width={alimaPhoto.width ?? 800} height={alimaPhoto.height ?? 1000} className="h-auto w-full" sizes="(min-width: 768px) 24rem, 90vw" />
              {alimaPhoto.caption && <figcaption className="mt-2 font-script text-[1.2rem] text-caramel-encre">{alimaPhoto.caption}</figcaption>}
            </figure>
          )}
        </div>
      </section>

      <section aria-labelledby="cafe" className="ohm-grille">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
          <Annotation>un projet, pas encore une adresse</Annotation>
          <h2 id="cafe" className="font-display text-[clamp(1.8rem,4.5vw,2.6rem)] leading-[1.05]">
            Un jour, le café OHMEGATO
          </h2>
          <p className="mt-4 text-[1.1rem]">
            Le café OHMEGATO <strong>n&apos;existe pas encore</strong> : c&apos;est une vision pour l&apos;avenir. Un lieu où l&apos;on trouverait :
          </p>
          <ul className="mt-6 flex flex-wrap gap-3">
            {CAFE.map((item) => (
              <li key={item} className="rounded-full border-2 border-dashed border-chocolat/50 bg-blanc-casse px-4 py-2">
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-encre-douce">En attendant, OHMEGATO cuisine par fournées et livre dans Dakar.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/fournees">Voir la fournée en cours</ButtonLink>
            <ButtonLink href="/sur-mesure" variant="secondary">
              Demander un sur-mesure
            </ButtonLink>
          </div>
        </div>
      </section>
    </article>
  );
}
