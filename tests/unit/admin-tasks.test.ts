import { describe, expect, it } from "vitest";
import { buildTasks, humanDuration, nextCycleStep, type TaskInput } from "@/lib/admin/tasks";
import { cleanQuery } from "@/lib/admin/query";
import { whatsappLink, whatsappMessage } from "@/lib/admin/whatsapp";
import { parseAutomationSettings } from "@/lib/admin/automation-settings";

const NOW = Date.parse("2026-10-15T10:00:00Z");

const empty: TaskInput = {
  now: NOW,
  cycle: null,
  needsAttention: 0,
  waveToVerify: { count: 0, oldestAt: null },
  paymentAlertHours: 24,
  toPrepare: 0,
  ready: { pickup: 0, delivery: 0 },
  incompleteAddresses: 0,
  customToAnswer: 0,
  allergensToVerify: 0,
  identityMissing: false,
};

const openCycle = {
  id: "c1",
  number: 1,
  status: "open",
  opensAt: "2026-10-10T00:00:00Z",
  closesAt: "2026-10-18T23:59:00Z",
  fulfillmentDate: "2026-10-23",
  surplusEndsAt: null,
  productionRecorded: false,
};

describe("tâches de l'atelier", () => {
  it("aucune tâche inventée quand rien n'attend", () => {
    expect(buildTasks(empty)).toEqual([]);
  });

  it("phrases accordées et tri par priorité réelle", () => {
    const tasks = buildTasks({ ...empty, waveToVerify: { count: 3, oldestAt: "2026-10-15T08:00:00Z" }, toPrepare: 1, allergensToVerify: 2, needsAttention: 1 });
    expect(tasks.map((t) => t.key)).toEqual(["needs-attention", "wave-to-verify", "to-prepare", "allergens"]);
    expect(tasks[1]!.title).toBe("3 paiements Wave attendent votre vérification");
    expect(tasks[2]!.title).toBe("1 commande payée doit être préparée");
  });

  it("un paiement Wave ancien devient urgent selon le délai réglé", () => {
    const fresh = buildTasks({ ...empty, waveToVerify: { count: 1, oldestAt: "2026-10-15T08:00:00Z" } })[0]!;
    const old = buildTasks({ ...empty, waveToVerify: { count: 1, oldestAt: "2026-10-14T08:00:00Z" } })[0]!;
    expect(fresh.priority).toBe("today");
    expect(old.priority).toBe("urgent");
    expect(old.detail).toContain("26 h");
    expect(buildTasks({ ...empty, paymentAlertHours: 1, waveToVerify: { count: 1, oldestAt: "2026-10-15T08:00:00Z" } })[0]!.priority).toBe("urgent");
  });

  it("date limite passée sans clôture : tâche « Clôturer et imprimer », jamais avant", () => {
    expect(buildTasks({ ...empty, cycle: openCycle }).some((t) => t.key.endsWith("-close"))).toBe(false);
    const after = buildTasks({ ...empty, now: Date.parse("2026-10-19T00:00:00Z"), cycle: openCycle });
    expect(after.find((t) => t.key === "cycle-c1-close")?.action).toBe("Clôturer et imprimer");
  });

  it("production réelle non saisie signalée pendant la production", () => {
    expect(buildTasks({ ...empty, cycle: { ...openCycle, status: "preparing" } }).some((t) => t.key === "cycle-c1-production")).toBe(true);
    expect(buildTasks({ ...empty, cycle: { ...openCycle, status: "preparing", productionRecorded: true } }).some((t) => t.key === "cycle-c1-production")).toBe(false);
  });

  it("une seule cliente sans repère : phrase au singulier", () => {
    expect(buildTasks({ ...empty, incompleteAddresses: 1 })[0]!.title).toBe("Une cliente n'a pas précisé son point de repère");
  });
});

describe("prochaine étape de la fournée", () => {
  it("suit le parcours de la fournée", () => {
    expect(nextCycleStep(null, 0, NOW).action).toBe("Créer une fournée");
    expect(nextCycleStep({ ...openCycle, status: "draft" }, 0, NOW).title).toBe("Ouvrir les précommandes");
    expect(nextCycleStep(openCycle, 2, NOW).title).toBe("Vérifier les paiements");
    expect(nextCycleStep(openCycle, 0, NOW).title).toBe("Suivre les précommandes");
    expect(nextCycleStep(openCycle, 0, Date.parse("2026-10-19T00:00:00Z")).title).toBe("Clôturer administrativement");
    expect(nextCycleStep({ ...openCycle, status: "closed" }, 0, NOW).title).toBe("Imprimer la fiche de production");
    expect(nextCycleStep({ ...openCycle, status: "delivering" }, 0, NOW).title).toBe("Saisir la production réelle");
  });
});

describe("outils de l'atelier", () => {
  it("durées humaines", () => {
    expect(humanDuration(3 * 86_400_000 + 5 * 3_600_000)).toBe("3 j 5 h");
    expect(humanDuration(2 * 3_600_000 + 7 * 60_000)).toBe("2 h 07 min");
    expect(humanDuration(-5)).toBe("0 min");
  });

  it("la recherche ne laisse passer aucune syntaxe de filtre", () => {
    expect(cleanQuery("OHM1-0001")).toBe("OHM1-0001");
    expect(cleanQuery("a,b.or(id.eq.1)%")).toBe("a b.or id.eq.1");
  });

  it("lien WhatsApp pré-rédigé, sans envoi automatique", () => {
    const link = whatsappLink("+221 77 000 00 00", whatsappMessage("payment_check", { customerName: "Awa Diop", reference: "OHM1-0001", totalFcfa: 4500 }));
    expect(link.startsWith("https://wa.me/221770000000?text=")).toBe(true);
    expect(decodeURIComponent(link)).toContain("Bonjour Awa");
    expect(decodeURIComponent(link)).toContain("OHM1-0001");
  });

  it("réglages des délais : valeurs par défaut et bornes", () => {
    expect(parseAutomationSettings(undefined).paymentAlertHours).toBe(24);
    expect(parseAutomationSettings({ paymentAlertHours: 6 }).paymentAlertHours).toBe(6);
    expect(parseAutomationSettings({ paymentAlertHours: -1 }).paymentAlertHours).toBe(24);
  });
});
