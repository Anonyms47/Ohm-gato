/** Schéma du formulaire « Le bon de fournée » (étapes 1 à 4). */
import { z } from "zod";
import { contactSchema, deliverySchema } from "@/lib/validation/checkout";

export const checkoutFormSchema = z
  .object({
    contact: contactSchema,
    fulfillment: z.enum(["delivery", "pickup"], { message: "Choisissez la livraison ou le retrait." }),
    delivery: z.unknown(),
    slotId: z.string().min(1, "Choisissez un créneau."),
    notes: z.string().trim().max(500, "500 caractères maximum.").optional(),
  })
  .transform((value, ctx) => {
    if (value.fulfillment === "pickup") return { ...value, delivery: null };
    const parsed = deliverySchema.safeParse(value.delivery);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        ctx.addIssue({ code: "custom", path: ["delivery", ...issue.path.map(String)], message: issue.message });
      }
      return z.NEVER;
    }
    return { ...value, delivery: parsed.data };
  });

export interface CheckoutFormValues {
  contact: { name: string; phone: string; email: string };
  fulfillment: "delivery" | "pickup" | "";
  delivery: {
    district: string;
    addressLine: string;
    landmark: string;
    floorDoor: string;
    recipientName: string;
    recipientPhone: string;
    instructions: string;
    latitude: number | null;
    longitude: number | null;
  };
  slotId: string;
  notes: string;
}

export type CheckoutFormOutput = z.output<typeof checkoutFormSchema>;

export const emptyCheckoutForm: CheckoutFormValues = {
  contact: { name: "", phone: "", email: "" },
  fulfillment: "",
  delivery: {
    district: "",
    addressLine: "",
    landmark: "",
    floorDoor: "",
    recipientName: "",
    recipientPhone: "",
    instructions: "",
    latitude: null,
    longitude: null,
  },
  slotId: "",
  notes: "",
};

export type CheckoutStep = "coordonnees" | "reception" | "creneau" | "notes";

/**
 * Validation d'une étape du bon de fournée, indépendante des autres étapes
 * (un créneau pas encore choisi ne doit pas masquer les erreurs de l'adresse).
 */
export function stepIssues(step: CheckoutStep, values: CheckoutFormValues): { field: string; message: string }[] {
  const prefixed = (prefix: string, issues: { path: PropertyKey[]; message: string }[]) =>
    issues.map((i) => ({ field: [prefix, ...i.path.map(String)].join("."), message: i.message }));
  switch (step) {
    case "coordonnees": {
      const parsed = contactSchema.safeParse(values.contact);
      return parsed.success ? [] : prefixed("contact", parsed.error.issues);
    }
    case "reception": {
      if (values.fulfillment === "") return [{ field: "fulfillment", message: "Choisissez la livraison ou le retrait." }];
      if (values.fulfillment === "pickup") return [];
      const parsed = deliverySchema.safeParse(values.delivery);
      return parsed.success ? [] : prefixed("delivery", parsed.error.issues);
    }
    case "creneau":
      return values.slotId ? [] : [{ field: "slotId", message: "Choisissez un créneau." }];
    case "notes":
      return values.notes.trim().length > 500 ? [{ field: "notes", message: "500 caractères maximum." }] : [];
  }
}

/** Toutes les erreurs connues d'un champ, quelle que soit son étape. */
export function fieldIssue(field: string, values: CheckoutFormValues): string | undefined {
  const steps: CheckoutStep[] = ["coordonnees", "reception", "creneau", "notes"];
  return steps.flatMap((s) => stepIssues(s, values)).find((i) => i.field === field)?.message;
}
