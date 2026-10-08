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
    zoneId: string | null;
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
    zoneId: null,
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
