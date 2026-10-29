import { describe, expect, it } from "vitest";
import { deliveryFeeLine, districtOptions, normalizePlace, parseDistricts, zoneForDistrict, type DeliveryZone } from "@/lib/delivery/zones";
import { parseZonesCsv, zonesToCsv } from "@/lib/delivery/zones-csv";
import { cleanSnapchatHandle, parseSnapchat, snapchatUrl, socialLinks } from "@/lib/social";
import { renderBatchAlert } from "@/lib/email/templates";
import { buildTasks, type TaskInput } from "@/lib/admin/tasks";

const zone = (over: Partial<DeliveryZone>): DeliveryZone => ({ id: "z", name: "Zone", districts: [], feeFcfa: null, isActive: true, sortOrder: 1, note: null, ...over });

describe("zones de livraison", () => {
  const zones = [
    zone({ id: "a", name: "Centre", districts: ["Plateau", "Médina"], feeFcfa: 1500, sortOrder: 1 }),
    zone({ id: "b", name: "Corniche", districts: ["Mermoz", "Ouakam"], feeFcfa: null, sortOrder: 2 }),
    zone({ id: "c", name: "Ancienne", districts: ["Yoff"], feeFcfa: 3000, isActive: false, sortOrder: 3 }),
  ];
  it("normalise sans accents ni casse", () => {
    expect(normalizePlace("  Médina-Est ")).toBe("medina est");
  });
  it("retrouve la zone d'un quartier actif seulement", () => {
    expect(zoneForDistrict(zones, "medina")?.id).toBe("a");
    expect(zoneForDistrict(zones, "MERMOZ")?.id).toBe("b");
    expect(zoneForDistrict(zones, "Yoff")).toBeNull();
    expect(zoneForDistrict(zones, "")).toBeNull();
  });
  it("jamais de frais inventés : tarif vide = tarif confirmé", () => {
    expect(deliveryFeeLine(null)).toBe("Tarif confirmé selon votre position.");
    expect(deliveryFeeLine(1500)).toContain("à régler directement au livreur");
  });
  it("liste les quartiers des zones actives", () => {
    expect(districtOptions(zones).map((o) => o.value)).toEqual(["Plateau", "Médina", "Mermoz", "Ouakam"]);
  });
  it("nettoie la saisie des quartiers", () => {
    expect(parseDistricts("Plateau\nplateau; Médina,  Ouakam ")).toEqual(["Plateau", "Médina", "Ouakam"]);
  });
});

describe("import / export CSV des zones", () => {
  it("lit une grille à point-virgule, regroupe par zone", () => {
    const r = parseZonesCsv("zone;quartier;tarif_fcfa;ordre;actif;note\nCentre;Plateau;1 500;1;oui;\nCentre;Médina;1500;;;\nCorniche;Mermoz;;2;non;sur confirmation\n");
    expect(r.errors).toEqual([]);
    expect(r.zones).toHaveLength(2);
    expect(r.zones[0]).toMatchObject({ name: "Centre", districts: ["Plateau", "Médina"], feeFcfa: 1500, sortOrder: 1, isActive: true });
    expect(r.zones[1]).toMatchObject({ name: "Corniche", feeFcfa: null, isActive: false, note: "sur confirmation" });
  });
  it("signale les erreurs ligne par ligne", () => {
    const r = parseZonesCsv("zone;quartier;tarif_fcfa\nA;X;abc\n;Y;100\nA;Z;100\nB;Z;100\n");
    expect(r.errors.map((e) => e.line)).toEqual([2, 3, 5]);
    expect(r.errors[2]!.message).toContain("deux zones actives");
  });
  it("refuse un fichier sans en-tête valide ou vide", () => {
    expect(parseZonesCsv("a;b\n1;2").errors[0]!.message).toContain("En-tête");
    expect(parseZonesCsv("").errors[0]!.message).toContain("vide");
  });
  it("aller-retour export puis import", () => {
    const zones = [zone({ id: "a", name: "Centre; Nord", districts: ["Plateau", "Médina"], feeFcfa: 1500, note: 'dit "vite"' }), zone({ id: "b", name: "Vide", sortOrder: 2 })];
    const r = parseZonesCsv(zonesToCsv(zones));
    expect(r.errors).toEqual([]);
    expect(r.zones.map((z) => [z.name, z.districts, z.feeFcfa, z.note])).toEqual([
      ["Centre; Nord", ["Plateau", "Médina"], 1500, 'dit "vite"'],
      ["Vide", [], null, null],
    ]);
  });
});

describe("réseaux sociaux", () => {
  it("valide l'identifiant et l'URL Snapchat", () => {
    expect(cleanSnapchatHandle("@ohmegato")).toBe("ohmegato");
    expect(cleanSnapchatHandle("1x")).toBeNull();
    expect(snapchatUrl("ohmegato", "")).toBe("https://www.snapchat.com/add/ohmegato");
    expect(snapchatUrl("ohmegato", "https://evil.example/x")).toBeNull();
    expect(snapchatUrl("ohmegato", "http://www.snapchat.com/add/x")).toBeNull();
  });
  it("Snapchat masqué tant qu'il n'est pas activé avec un vrai identifiant", () => {
    expect(socialLinks({}).snapchat).toBeNull();
    expect(socialLinks({ "social.snapchat": { handle: "ohmegato", url: "", enabled: false } }).snapchat).toBeNull();
    expect(socialLinks({ "social.snapchat": { handle: "", url: "", enabled: true } }).snapchat).toBeNull();
    expect(socialLinks({ "social.snapchat": { handle: "ohmegato", url: "", enabled: true } }).snapchat?.handle).toBe("ohmegato");
    expect(parseSnapchat("x")).toBeNull();
    expect(socialLinks({}).instagram.url).toMatch(/^https:\/\/(www\.)?instagram\.com\//);
  });
});

describe("e-mail d'alerte de fournée", () => {
  const mail = renderBatchAlert({
    cycleNumber: 12,
    message: "Commandez avant le vendredi 30 octobre à 18 h 00.",
    siteUrl: "https://ohmegato.com/fournees",
    unsubscribeUrl: "https://ohmegato.com/alertes/desinscription/abc",
    oneClickUrl: "https://ohmegato.com/api/alertes/desinscription?jeton=abc",
  });
  it("contient la fournée, le lien de désinscription, aucun nom personnel", () => {
    expect(mail.subject).toContain("n°12");
    expect(mail.text).toContain("Se désinscrire : https://ohmegato.com/alertes/desinscription/abc");
    expect(mail.html).toContain("desinscription/abc");
    expect(mail.text + mail.html).not.toMatch(/Thiam|Sadiya|Alimatou/);
  });
});

describe("tâches de configuration de l'atelier", () => {
  const base = { now: Date.parse("2026-10-15T10:00:00Z"), cycle: null, needsAttention: 0, waveToVerify: { count: 0, oldestAt: null }, paymentAlertHours: 24, toPrepare: 0, ready: { pickup: 0, delivery: 0 }, incompleteAddresses: 0, customToAnswer: { overdue: 0, fresh: 0 }, customAnswerHours: 48, slotSoonNotReady: 0 } as unknown as TaskInput;
  it("signale l'absence de zone, sans rien bloquer", () => {
    const tasks = buildTasks({ ...base, setup: { zonesActive: 0, paymentsWithoutLink: [], alerts: { activeSubscribers: 0, sendsToReview: 0, openCycleNumber: null, openCycleAnnounced: false } } });
    expect(tasks.some((t) => t.key === "zones-missing")).toBe(true);
    expect(buildTasks({ ...base, setup: { zonesActive: 2, paymentsWithoutLink: [], alerts: { activeSubscribers: 0, sendsToReview: 0, openCycleNumber: null, openCycleAnnounced: false } } }).some((t) => t.key === "zones-missing")).toBe(false);
  });
  it("propose de prévenir les inscrits d'une fournée ouverte", () => {
    const tasks = buildTasks({ ...base, setup: { zonesActive: 1, paymentsWithoutLink: [], alerts: { activeSubscribers: 3, sendsToReview: 0, openCycleNumber: 12, openCycleAnnounced: false } } });
    expect(tasks.some((t) => t.key === "alert-announce-12")).toBe(true);
  });
});
