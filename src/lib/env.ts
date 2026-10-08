import "server-only";
import { z } from "zod";

/** Variables serveur. Aucun secret n'est préfixé NEXT_PUBLIC_. */
const schema = z.object({
  APP_ENV: z.enum(["development", "test", "staging", "production"]).default("development"),
  NEXT_PUBLIC_SITE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
  /** Secret de dérivation des liens de suivi (32 caractères minimum). */
  TRACKING_TOKEN_SECRET: z.string().min(32),
  PAYMENT_TEST_MODE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  PAYMENT_TEST_WEBHOOK_SECRET: z.string().min(32).optional(),
  WAVE_API_KEY: z.string().min(1).optional(),
  WAVE_WEBHOOK_SECRET: z.string().min(1).optional(),
  ORANGE_MONEY_CLIENT_ID: z.string().min(1).optional(),
  ORANGE_MONEY_CLIENT_SECRET: z.string().min(1).optional(),
  ORANGE_MONEY_MERCHANT_CODE: z.string().min(1).optional(),
  ORANGE_MONEY_WEBHOOK_SECRET: z.string().min(1).optional(),
  /**
   * Lien de paiement marchand Wave (sans API). La commande est confirmée au choix de Wave,
   * le paiement est vérifié et enregistré à la main par OHMEGATO dans /admin.
   */
  WAVE_PAYMENT_LINK: z
    .url()
    .refine((v) => v.startsWith("https://pay.wave.com/"), "Lien Wave attendu (https://pay.wave.com/…).")
    .optional(),
  /**
   * Codes de connexion affichés à l'écran au lieu d'être envoyés (développement et tests).
   * Interdit en production.
   */
  OTP_TEST_MODE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  /** WhatsApp Cloud API (Meta) — remise des codes de connexion. À RENSEIGNER. */
  WHATSAPP_ACCESS_TOKEN: z.string().min(1).optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1).optional(),
  /** Modèle « authentification » approuvé par Meta (paramètre unique : le code). */
  WHATSAPP_OTP_TEMPLATE: z.string().min(1).optional(),
  WHATSAPP_TEMPLATE_LANGUAGE: z.string().min(2).default("fr"),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Configuration serveur incomplète : ${fields}. Voir .env.example.`);
  }
  if (parsed.data.APP_ENV === "production" && parsed.data.PAYMENT_TEST_MODE) {
    throw new Error("PAYMENT_TEST_MODE est interdit en production.");
  }
  if (parsed.data.APP_ENV === "production" && parsed.data.OTP_TEST_MODE) {
    throw new Error("OTP_TEST_MODE est interdit en production.");
  }
  cached = parsed.data;
  return cached;
}
