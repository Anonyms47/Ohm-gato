import "server-only";
import { serverEnv } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";

export class MessagingUnavailableError extends Error {
  constructor(message = "Aucun canal d'envoi n'est configuré.") {
    super(message);
  }
}

export interface DeliveredCode {
  channel: "whatsapp" | "test";
  /** Code visible à l'écran : uniquement en mode test (OTP_TEST_MODE). */
  testCode?: string;
}

/** Connexion par téléphone possible : WhatsApp configuré, ou mode test (codes affichés à l'écran). */
export function phoneLoginAvailable(): boolean {
  const env = serverEnv();
  return Boolean(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_OTP_TEMPLATE) || env.OTP_TEST_MODE;
}

/**
 * Remise d'un code de connexion sur le téléphone du client.
 * Ordre : WhatsApp Cloud API si configurée ; sinon, en mode test seulement, boîte de test.
 * Sans canal réel en production, l'envoi échoue proprement (jamais de faux succès).
 */
export async function deliverLoginCode(phoneE164: string, code: string): Promise<DeliveredCode> {
  const env = serverEnv();
  if (env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_OTP_TEMPLATE) {
    await sendWhatsAppCode(phoneE164, code);
    return { channel: "whatsapp" };
  }
  if (env.OTP_TEST_MODE) {
    await supabaseAdmin()
      .from("test_messages")
      .insert({ channel: "phone", destination: phoneE164, body: `Code OHMEGATO : ${code}` });
    return { channel: "test", testCode: code };
  }
  throw new MessagingUnavailableError();
}

/**
 * WhatsApp Cloud API — modèle de catégorie « authentification » (code en paramètre du
 * corps et du bouton « copier le code »), d'après la documentation publique de Meta.
 * À valider avec le compte WhatsApp Business d'OHMEGATO avant la mise en production.
 */
async function sendWhatsAppCode(phoneE164: string, code: string) {
  const env = serverEnv();
  const response = await fetch(`https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phoneE164.replace(/^\+/, ""),
      type: "template",
      template: {
        name: env.WHATSAPP_OTP_TEMPLATE,
        language: { code: env.WHATSAPP_TEMPLATE_LANGUAGE },
        components: [
          { type: "body", parameters: [{ type: "text", text: code }] },
          { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
        ],
      },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new MessagingUnavailableError(`WhatsApp a refusé l'envoi (${response.status}).`);
}
