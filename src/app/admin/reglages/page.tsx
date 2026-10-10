import { RemoveMedia, RolesEditor, StoryMediaUpload, TextSetting } from "@/components/admin/SettingsEditors";
import { WorkshopTracesEditor } from "@/components/admin/WorkshopTracesEditor";
import { getSettings, getWorkshopTraces, listAllergens, listStaff } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/auth/session";

export const metadata = { title: "Réglages et rôles" };

export default async function AdminReglages() {
  const admin = await requireAdmin();
  const [settings, staff, workshop, allergens] = await Promise.all([getSettings(), listStaff(), getWorkshopTraces(), listAllergens()]);
  const text = (key: string) => (typeof settings[key]?.value === "string" ? (settings[key]!.value as string) : "");
  const archives = Array.isArray(settings["story.archive_photos"]?.value) ? (settings["story.archive_photos"]!.value as { url: string; alt: string }[]) : [];
  const alima = settings["story.alima_photo"]?.value as { url: string; alt: string } | undefined;
  const audio = settings["story.audio"]?.value as { url: string } | undefined;
  return (
    <div className="flex max-w-3xl flex-col gap-10">
      <h1 className="font-display text-[clamp(1.8rem,4vw,2.4rem)]">Réglages et rôles</h1>
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-[1.5rem]">Textes</h2>
        <p className="text-encre-douce">Un texte vide n&apos;est jamais affiché : rien n&apos;est inventé à sa place.</p>
        <TextSetting settingKey="home.alima_note" label="Le mot d'Alima (accueil)" hint="Affiché sur l'accueil, signé Alima." initial={text("home.alima_note")} />
        <TextSetting settingKey="story.quote" label="Citation d'Alima (Notre histoire)" hint="Uniquement une vraie citation." initial={text("story.quote")} />
      </section>
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-[1.5rem]">Traces d&apos;atelier</h2>
        <WorkshopTracesEditor initial={workshop} allergens={allergens} />
      </section>
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-[1.5rem]">Médias de « Notre histoire »</h2>
        <ul className="flex flex-col gap-2">
          {archives.map((p) => (
            <li key={p.url} className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] bg-blanc-casse p-3">
              <span>Archive : {p.alt}</span>
              <RemoveMedia kind="archive" url={p.url} label="cette archive" />
            </li>
          ))}
          {alima && (
            <li className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] bg-blanc-casse p-3">
              <span>Photo d&apos;Alima : {alima.alt}</span>
              <RemoveMedia kind="alima" url={alima.url} label="la photo" />
            </li>
          )}
          {audio && (
            <li className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] bg-blanc-casse p-3">
              <span>Audio d&apos;Alima</span>
              <RemoveMedia kind="audio" url={audio.url} label="l'audio" />
            </li>
          )}
          {archives.length === 0 && !alima && !audio && <li className="text-encre-douce">Aucun média : ces emplacements restent masqués sur le site.</li>}
        </ul>
        <StoryMediaUpload />
      </section>
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-[1.5rem]">Rôles administrateurs</h2>
        <RolesEditor staff={staff} currentUserId={admin.id} />
      </section>
    </div>
  );
}
