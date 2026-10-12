import { z } from "zod";

/**
 * Délais des alertes internes (jamais affichés aux clientes, aucun engagement commercial public).
 * Stockés dans site_settings["admin_automation"] (non public), modifiables dans Réglages.
 */
export const automationSettingsSchema = z.object({
  /** Un paiement Wave non vérifié devient prioritaire après ce délai (heures). */
  paymentAlertHours: z.coerce.number().int().min(1).max(240).default(24),
  /** Une demande sur mesure sans réponse est signalée après ce délai (heures). */
  customAnswerHours: z.coerce.number().int().min(1).max(240).default(48),
  /** Rappel des livraisons et retraits à venir (heures avant le créneau). */
  slotReminderHours: z.coerce.number().int().min(1).max(72).default(24),
  /** Envoi des e-mails transactionnels aux clientes (si un service d'envoi est configuré). */
  customerEmails: z.boolean().default(true),
  /** Résumé quotidien envoyé à l'équipe par e-mail (si configuré). */
  dailyDigest: z.boolean().default(false),
});

export type AutomationSettings = z.infer<typeof automationSettingsSchema>;

export const AUTOMATION_SETTINGS_KEY = "admin_automation";

export function parseAutomationSettings(value: unknown): AutomationSettings {
  const parsed = automationSettingsSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : automationSettingsSchema.parse({});
}
