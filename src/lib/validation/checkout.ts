/**
 * Schémas partagés navigateur / serveur pour « Le bon de fournée ».
 * Le serveur revalide systématiquement ; les prix n'en font jamais partie.
 */
import { z } from "zod";
import { MAX_LINE_QUANTITY, MAX_LINES } from "@/lib/cart";
import { normalizeSenegalPhone } from "@/lib/phone";

const trimmed = (max: number) => z.string().trim().max(max, `${max} caractères maximum.`);

export const senegalPhone = z
  .string()
  .trim()
  .min(1, "Indiquez un numéro de téléphone.")
  .transform((value, ctx) => {
    const normalized = normalizeSenegalPhone(value);
    if (!normalized) {
      ctx.addIssue({
        code: "custom",
        message: "Ce numéro ne ressemble pas à un numéro sénégalais (ex. 77 123 45 67).",
      });
      return z.NEVER;
    }
    return normalized;
  });

export const cartLineSchema = z.object({
  variantId: z.uuid(),
  flavorId: z.uuid().nullable(),
  quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY),
});

export const cartLinesSchema = z
  .array(cartLineSchema)
  .min(1, "Votre boîte est vide.")
  .max(MAX_LINES);

export const contactSchema = z.object({
  name: trimmed(80).min(2, "Indiquez votre nom."),
  phone: senegalPhone,
  email: z
    .union([z.literal(""), z.email("Cette adresse e-mail n'est pas valide.").max(160)])
    .optional()
    .transform((v) => v || undefined),
});

/**
 * Livraison : position exacte (obligatoire, transmise à OHMEGATO) et contact du destinataire.
 * Adresse écrite, quartier et point de repère complètent la position : facultatifs, remplis
 * automatiquement depuis la position quand c'est possible. Les frais se règlent au livreur.
 */
export const deliverySchema = z.object({
  addressLine: trimmed(200),
  district: trimmed(80),
  landmark: trimmed(160),
  floorDoor: trimmed(80).optional(),
  recipientName: trimmed(80).min(2, "Indiquez qui réceptionne la commande."),
  recipientPhone: senegalPhone,
  instructions: trimmed(300).optional(),
  latitude: z.number({ message: "Placez le repère de livraison sur la carte." }).min(14.4).max(15.0),
  longitude: z.number({ message: "Placez le repère de livraison sur la carte." }).min(-17.6).max(-16.9),
});

export const paymentProviderSchema = z.enum(["wave", "wave_link", "orange_money", "test"]);
export type PaymentProviderId = z.infer<typeof paymentProviderSchema>;

export const placeOrderSchema = z
  .object({
    idempotencyKey: z.uuid(),
    cycleId: z.uuid(),
    fulfillment: z.enum(["delivery", "pickup"]),
    slotId: z.uuid({ message: "Choisissez un créneau." }),
    contact: contactSchema,
    delivery: deliverySchema.nullable(),
    notes: trimmed(500).optional(),
    lines: cartLinesSchema,
    paymentProvider: paymentProviderSchema,
    /** Versions des conditions générales et de la politique d'annulation acceptées (case cochée). */
    acceptance: z.object(
      {
        accepted: z.literal(true, { message: "Acceptez les conditions générales pour continuer." }),
        termsVersionId: z.uuid(),
        cancellationVersionId: z.uuid(),
      },
      { message: "Acceptez les conditions générales pour continuer." },
    ),
  })
  .superRefine((value, ctx) => {
    if (value.fulfillment === "delivery" && !value.delivery) {
      ctx.addIssue({ code: "custom", path: ["delivery"], message: "Indiquez l'adresse de livraison." });
    }
  });

export type PlaceOrderInput = z.input<typeof placeOrderSchema>;
export type PlaceOrderData = z.output<typeof placeOrderSchema>;

/** Adresse enregistrée : celle saisie, sinon la position exacte (toujours présente). */
export function deliveryAddressLine(d: { addressLine: string; latitude: number; longitude: number }): string {
  return d.addressLine || `Position sur la carte (${d.latitude.toFixed(5)}, ${d.longitude.toFixed(5)})`;
}
