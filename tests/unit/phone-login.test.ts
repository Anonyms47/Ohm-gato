import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => ({}) }));
const env: Record<string, unknown> = {};
vi.mock("@/lib/env", () => ({ serverEnv: () => env }));

const { phoneLoginAvailable } = await import("@/lib/messaging");

describe("connexion par téléphone", () => {
  beforeEach(() => {
    for (const key of Object.keys(env)) delete env[key];
  });

  it("masquée en production tant que WhatsApp n'est pas branché", () => {
    env.OTP_TEST_MODE = false;
    expect(phoneLoginAvailable()).toBe(false);
  });

  it("disponible dès que WhatsApp est configuré, ou en mode test", () => {
    Object.assign(env, { OTP_TEST_MODE: false, WHATSAPP_ACCESS_TOKEN: "t", WHATSAPP_PHONE_NUMBER_ID: "1", WHATSAPP_OTP_TEMPLATE: "code" });
    expect(phoneLoginAvailable()).toBe(true);
    for (const key of Object.keys(env)) delete env[key];
    env.OTP_TEST_MODE = true;
    expect(phoneLoginAvailable()).toBe(true);
  });
});
