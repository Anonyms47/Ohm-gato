import { describe, expect, it } from "vitest";
import type { CycleSummary } from "@/lib/catalog-types";
import { customRequestEditable, customRequestOpen } from "@/lib/custom/status";
import { cyclePhase, journalSteps } from "@/lib/cycle-status";
import { sniffType } from "@/lib/file-type";
import { storageAdvice, storageText } from "@/lib/storage";
import { customRequestSchema, eventDateTime } from "@/lib/validation/custom-request";

const hour = 3600 * 1000;
function cycle(status: string, opensIn: number, closesIn: number): CycleSummary {
  const now = Date.now();
  return {
    id: "c",
    number: 1,
    title: "t",
    message: null,
    opensAt: new Date(now + opensIn * hour).toISOString(),
    closesAt: new Date(now + closesIn * hour).toISOString(),
    productionDate: "2030-01-01",
    fulfillmentDate: "2030-01-02",
    status,
    isOpen: false,
    featuredProductSlug: null,
    palette: "caramel",
  };
}

describe("journal du four", () => {
  it("une fournée ouverte dont la clôture est passée s'affiche clôturée", () => {
    expect(cyclePhase(cycle("open", -48, -1))).toBe("closed");
    expect(cyclePhase(cycle("open", -1, 24))).toBe("open");
    expect(cyclePhase(cycle("open", 2, 24))).toBe("scheduled");
  });

  it("marque les étapes passées, en cours et à venir", () => {
    const states = journalSteps(cycle("preparing", -72, -24)).map((s) => s.state);
    expect(states).toEqual(["done", "done", "current", "upcoming"]);
    expect(journalSteps(cycle("cancelled", -72, -24)).every((s) => s.state === "cancelled")).toBe(true);
    expect(journalSteps(cycle("done", -72, -24)).every((s) => s.state === "done")).toBe(true);
  });
});

describe("sur-mesure", () => {
  const valid = {
    idempotencyKey: "11111111-0000-4000-8000-000000000001",
    occasion: "Anniversaire",
    eventDate: new Date(Date.now() + 5 * 24 * hour).toISOString().slice(0, 10),
    eventTime: "16:00",
    guests: 20,
    items: [{ kind: "verrines", quantity: 20 }],
    fulfillment: "pickup",
    delivery: null,
    contact: { name: "Awa", phone: "77 123 45 67", email: "" },
  };

  it("accepte une demande complète et normalise le téléphone", () => {
    const parsed = customRequestSchema.parse(valid);
    expect(parsed.contact.phone).toBe("+221771234567");
  });

  it("refuse une date à moins de 2 jours", () => {
    const soon = { ...valid, eventDate: new Date().toISOString().slice(0, 10), eventTime: "23:30" };
    expect(customRequestSchema.safeParse(soon).success).toBe(false);
  });

  it("exige l'adresse et la position pour une livraison", () => {
    expect(customRequestSchema.safeParse({ ...valid, fulfillment: "delivery" }).success).toBe(false);
  });

  it("refuse un produit inconnu", () => {
    expect(customRequestSchema.safeParse({ ...valid, items: [{ kind: "pizza", quantity: 1 }] }).success).toBe(false);
  });

  it("lit la date à l'heure de Dakar (UTC+0)", () => {
    expect(eventDateTime("2030-05-01", "16:30")?.toISOString()).toBe("2030-05-01T16:30:00.000Z");
    expect(eventDateTime("01/05/2030", "16:30")).toBeNull();
  });

  it("modification et échanges selon le statut", () => {
    expect(customRequestEditable("received")).toBe(true);
    expect(customRequestEditable("proposal_sent")).toBe(false);
    expect(customRequestOpen("declined")).toBe(false);
    expect(customRequestOpen("paid")).toBe(true);
  });
});

describe("fichiers joints", () => {
  it("reconnaît le vrai type d'après les premiers octets", () => {
    expect(sniffType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe("image/jpeg");
    expect(sniffType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.mime).toBe("image/png");
    expect(sniffType(new TextEncoder().encode("%PDF-1.7"))?.mime).toBe("application/pdf");
    expect(sniffType(new TextEncoder().encode("<script>alert(1)</script>"))).toBeNull();
  });
});

describe("conservation", () => {
  it("applique exactement les règles d'Alima", () => {
    expect(storageText.refrigerated_48h).toContain("réfrigérateur");
    expect(storageText.refrigerated_48h).toContain("2 jours");
    expect(storageText.ambient_airtight_48h).toContain("boîte hermétique");
    expect(storageText.cool_wrapped_1w).toContain("une semaine");
    expect(storageAdvice("ambient_airtight_48h", "Peuvent être légèrement réchauffés avant dégustation.")).toMatch(/2 jours\. Peuvent être/);
  });
});
