/** Schémas partagés navigateur / serveur pour le carnet sur-mesure. */
import { z } from "zod";
import { CUSTOM_KINDS, CUSTOM_MIN_DELAY_HOURS } from "@/lib/custom/status";
import { contactSchema, deliverySchema } from "@/lib/validation/checkout";

const trimmed = (max: number) => z.string().trim().max(max, `${max} caractères maximum.`);
const optionalText = (max: number) =>
  trimmed(max)
    .optional()
    .transform((v) => v || undefined);

export const customItemSchema = z.object({
  kind: z.enum(CUSTOM_KINDS.map((k) => k.value) as [string, ...string[]], { message: "Choisissez un produit." }),
  quantity: z
    .number({ message: "Indiquez une quantité." })
    .int("Quantité entière.")
    .min(1, "Au moins 1.")
    .max(2000, "2 000 au maximum."),
  format: optionalText(80),
  flavors: optionalText(120),
  description: optionalText(300),
});

/** Date et heure de l'événement, à l'heure de Dakar (UTC+0). */
export function eventDateTime(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const value = new Date(`${date}T${time}:00Z`);
  return Number.isNaN(value.getTime()) ? null : value;
}

export const customRequestSchema = z
  .object({
    idempotencyKey: z.uuid(),
    occasion: trimmed(80).min(2, "Choisissez le type d'occasion."),
    occasionDetail: optionalText(80),
    eventDate: z.string().min(1, "Choisissez la date."),
    eventTime: z.string().min(1, "Choisissez l'heure."),
    guests: z.number({ message: "Indiquez le nombre de personnes." }).int().min(1, "Au moins 1 personne.").max(5000),
    items: z.array(customItemSchema).min(1, "Ajoutez au moins un produit.").max(12, "12 lignes au maximum."),
    ambiance: optionalText(600),
    personalization: optionalText(600),
    budgetFcfa: z.number().int().min(0).max(50_000_000).nullable().optional(),
    fulfillment: z.enum(["delivery", "pickup"], { message: "Choisissez la livraison ou le retrait." }),
    delivery: deliverySchema.nullable(),
    contact: contactSchema,
    notes: optionalText(1000),
  })
  .superRefine((value, ctx) => {
    const at = eventDateTime(value.eventDate, value.eventTime);
    if (!at) {
      ctx.addIssue({ code: "custom", path: ["eventDate"], message: "Date ou heure invalide." });
    } else if (at.getTime() < Date.now() + CUSTOM_MIN_DELAY_HOURS * 3600 * 1000) {
      ctx.addIssue({
        code: "custom",
        path: ["eventDate"],
        message: "Prévoyez au moins 2 jours : le sur-mesure demande 2 à 4 jours selon la quantité.",
      });
    }
    if (value.fulfillment === "delivery" && !value.delivery) {
      ctx.addIssue({ code: "custom", path: ["delivery"], message: "Indiquez l'adresse de livraison." });
    }
  });

export type CustomRequestInput = z.input<typeof customRequestSchema>;

export const customMessageSchema = z.object({
  body: trimmed(2000).min(1, "Écrivez votre message."),
});

export const customEditSchema = z.object({
  eventDate: z.string().min(1),
  eventTime: z.string().min(1),
  guests: z.number().int().min(1).max(5000),
  ambiance: optionalText(600),
  personalization: optionalText(600),
  budgetFcfa: z.number().int().min(0).max(50_000_000).nullable().optional(),
  notes: optionalText(1000),
});
