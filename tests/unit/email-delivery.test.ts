import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildTasks, type TaskInput } from "@/lib/admin/tasks";
import {
  MAX_ATTEMPTS,
  brevoCheck,
  brevoSend,
  classifyBrevoError,
  errorLabel,
  errorScope,
  isStale,
  nextStepAfterFailure,
  sanitizeProviderMessage,
  type BrevoMessage,
} from "@/lib/email/delivery";

// Fausse clé de test, construite à l'exécution : jamais une vraie clé, rien de tel dans le dépôt.
const KEY = ["xkeysib", "0".repeat(64), "TESTONLYTESTONLY"].join("-");
const message: BrevoMessage = { sender: { name: "OHMEGATO", email: "contact@ohmegato.com" }, to: "cliente@example.com", subject: "Sujet", html: "<p>x</p>", text: "x", reference: "order:1:paid" };

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const fetchReturning = (...responses: Response[]) => {
  const fn = vi.fn(async () => responses.shift() ?? json(500, {}));
  return fn;
};

afterEach(() => vi.restoreAllMocks());

describe("classification des erreurs Brevo", () => {
  it.each([
    [401, { code: "unauthorized", message: "Key not found" }, "key_invalid"],
    [401, { code: "unauthorized", message: "API Key is not enabled" }, "key_invalid"],
    [401, { code: "unauthorized", message: "We have detected you are using an unrecognised IP address 203.0.113.7. If you performed this action make sure to add the new IP address in this link: https://app.brevo.com/security/authorised_ips" }, "ip_not_allowed"],
    [400, { code: "invalid_parameter", message: "Sender is not valid" }, "sender_unverified"],
    [403, { code: "permission_denied", message: "Unable to send email. Your SMTP account is not yet activated." }, "account_restricted"],
    [402, { code: "not_enough_credits", message: "Not enough credits" }, "quota"],
    [400, { code: "invalid_parameter", message: "email is blacklisted" }, "recipient_blocked"],
    [400, { code: "missing_parameter", message: "subject is missing" }, "bad_request"],
    [429, { code: "too_many_requests", message: "Rate limit" }, "rate_limited"],
    [503, null, "provider_unavailable"],
    [401, null, "auth_rejected"],
  ])("HTTP %i %j → %s", (status, body, expected) => {
    expect(classifyBrevoError(status, body)).toBe(expected);
  });

  it("messages compréhensibles pour l'équipe", () => {
    expect(errorLabel("key_invalid")).toBe("La clé Brevo n'est pas reconnue");
    expect(errorLabel("ip_not_allowed")).toBe("Brevo refuse actuellement l'adresse du serveur");
    expect(errorLabel("sender_unverified")).toBe("L'adresse expéditrice doit être vérifiée");
    expect(errorLabel("quota")).toBe("Le quota d'envoi est atteint");
    expect(errorLabel("provider_unavailable")).toBe("Brevo est temporairement indisponible");
    expect(errorScope("key_invalid")).toBe("provider");
    expect(errorScope("recipient_blocked")).toBe("message");
    expect(errorScope("network")).toBe("temporary");
  });
});

describe("nettoyage des messages du prestataire", () => {
  it("retire clés, mots de passe, adresses IP, e-mails et liens", () => {
    const raw = `Key ${KEY} refused for 203.0.113.7 / 2001:db8::1 sender a@b.co see https://app.brevo.com/x password=hunter2 xsmtpsib-abcdef123456`;
    const clean = sanitizeProviderMessage(raw, [KEY]);
    expect(clean).not.toContain(KEY);
    expect(clean).not.toContain("xsmtpsib");
    expect(clean).not.toContain("203.0.113.7");
    expect(clean).not.toContain("a@b.co");
    expect(clean).not.toContain("https://");
    expect(clean).not.toContain("hunter2");
    expect(sanitizeProviderMessage("x".repeat(500)).length).toBe(200);
    expect(sanitizeProviderMessage(undefined)).toBe("");
  });
});

describe("envoi Brevo", () => {
  it("clé absente : aucun appel, catégorie claire", async () => {
    const fetchImpl = fetchReturning();
    expect(await brevoSend(fetchImpl, undefined, message)).toMatchObject({ ok: false, category: "key_missing" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("réussite : identifiant Brevo conservé, clé seulement dans l'en-tête de la requête", async () => {
    const fetchImpl = fetchReturning(json(201, { messageId: "<202610140600.123@smtp-relay.mailin.fr>" }));
    const result = await brevoSend(fetchImpl, KEY, message);
    expect(result).toEqual({ ok: true, messageId: "<202610140600.123@smtp-relay.mailin.fr>" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect((init.headers as Record<string, string>)["api-key"]).toBe(KEY);
    expect(String(init.body)).not.toContain(KEY);
    expect(JSON.parse(String(init.body)).sender).toEqual({ name: "OHMEGATO", email: "contact@ohmegato.com" });
  });

  it("clé invalide, IP refusée, expéditeur refusé, quota : résultat sans aucun secret ni log", async () => {
    const consoleSpy = [vi.spyOn(console, "log"), vi.spyOn(console, "error"), vi.spyOn(console, "warn"), vi.spyOn(console, "info")];
    const cases: [Response, string][] = [
      [json(401, { code: "unauthorized", message: `Key not found: ${KEY}` }), "key_invalid"],
      [json(401, { code: "unauthorized", message: "unrecognised IP address 198.51.100.4" }), "ip_not_allowed"],
      [json(400, { code: "invalid_parameter", message: "Sender contact@ohmegato.com is not valid" }), "sender_unverified"],
      [json(402, { code: "not_enough_credits", message: "Not enough credits" }), "quota"],
    ];
    for (const [response, category] of cases) {
      const result = await brevoSend(fetchReturning(response), KEY, message);
      expect(result).toMatchObject({ ok: false, category, httpStatus: response.status });
      expect(JSON.stringify(result)).not.toContain(KEY);
      expect(JSON.stringify(result)).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
    }
    for (const spy of consoleSpy) expect(spy).not.toHaveBeenCalled();
  });

  it("panne réseau ou indisponibilité : erreur temporaire", async () => {
    const down = vi.fn(async () => {
      throw new Error(`connect ECONNREFUSED api-key=${KEY}`);
    });
    const result = await brevoSend(down, KEY, message);
    expect(result).toMatchObject({ ok: false, category: "network" });
    expect(JSON.stringify(result)).not.toContain(KEY);
    expect(await brevoSend(fetchReturning(json(503, {})), KEY, message)).toMatchObject({ ok: false, category: "provider_unavailable" });
  });
});

describe("test de connexion Brevo (sans envoi)", () => {
  it("clé reconnue et expéditeur actif", async () => {
    const fetchImpl = fetchReturning(json(200, { email: "x" }), json(200, { senders: [{ email: "contact@ohmegato.com", active: true }] }), json(200, { domains: [] }));
    expect(await brevoCheck(fetchImpl, KEY, "contact@ohmegato.com")).toEqual({ ok: true, senderAllowed: true });
    expect(fetchImpl.mock.calls.map((c) => (c as unknown as [string])[0])).toEqual([
      "https://api.brevo.com/v3/account",
      "https://api.brevo.com/v3/senders",
      "https://api.brevo.com/v3/senders/domains",
    ]);
  });

  it("domaine authentifié : expéditeur autorisé", async () => {
    const fetchImpl = fetchReturning(json(200, {}), json(200, { senders: [] }), json(200, { domains: [{ domain_name: "ohmegato.com", authenticated: true }] }));
    expect(await brevoCheck(fetchImpl, KEY, "contact@ohmegato.com")).toEqual({ ok: true, senderAllowed: true });
  });

  it("expéditeur non autorisé ou clé refusée", async () => {
    const notAllowed = fetchReturning(json(200, {}), json(200, { senders: [{ email: "autre@ohmegato.com", active: true }] }), json(200, { domains: [{ domain_name: "ohmegato.com", authenticated: false }] }));
    expect(await brevoCheck(notAllowed, KEY, "contact@ohmegato.com")).toEqual({ ok: true, senderAllowed: false });
    const refused = await brevoCheck(fetchReturning(json(401, { code: "unauthorized", message: "Key not found" })), KEY, "contact@ohmegato.com");
    expect(refused).toMatchObject({ ok: false, category: "key_invalid", httpStatus: 401 });
    expect(await brevoCheck(fetchReturning(), undefined, "contact@ohmegato.com")).toMatchObject({ ok: false, category: "key_missing" });
  });
});

describe("tentatives", () => {
  const now = new Date("2026-10-14T10:00:00Z");

  it("erreur temporaire : délai progressif puis arrêt", () => {
    const first = nextStepAfterFailure("provider_unavailable", 1, now);
    const second = nextStepAfterFailure("provider_unavailable", 2, now);
    expect(first).toEqual({ status: "pending", nextAttemptAt: new Date("2026-10-14T10:05:00Z") });
    expect(second).toEqual({ status: "pending", nextAttemptAt: new Date("2026-10-14T10:30:00Z") });
    expect(nextStepAfterFailure("network", MAX_ATTEMPTS, now)).toEqual({ status: "failed" });
  });

  it("erreur permanente : pas de boucle", () => {
    expect(nextStepAfterFailure("key_invalid", 1, now)).toEqual({ status: "held" });
    expect(nextStepAfterFailure("ip_not_allowed", 1, now)).toEqual({ status: "held" });
    expect(nextStepAfterFailure("recipient_blocked", 1, now)).toEqual({ status: "failed" });
    expect(nextStepAfterFailure("bad_request", 1, now)).toEqual({ status: "failed" });
  });

  it("message ancien : attend la confirmation, sauf reprise manuelle", () => {
    expect(isStale("2026-10-10T10:00:00Z", now, false)).toBe(true);
    expect(isStale("2026-10-10T10:00:00Z", now, true)).toBe(false);
    expect(isStale("2026-10-13T10:00:00Z", now, false)).toBe(false);
    expect(nextStepAfterFailure("stale", 1, now)).toEqual({ status: "held" });
  });
});

describe("alertes de l'atelier", () => {
  const base = {
    now: Date.parse("2026-10-14T10:00:00Z"),
    cycle: null,
    needsAttention: 0,
    waveToVerify: { count: 0, oldestAt: null },
    paymentAlertHours: 24,
    toPrepare: 0,
    ready: { pickup: 0, delivery: 0 },
    incompleteAddresses: 0,
    customToAnswer: { overdue: 0, fresh: 0 },
    customAnswerHours: 48,
    slotSoonNotReady: 0,
    slotReminderHours: 24,
    readyWithoutSlot: 0,
    allergensToVerify: 0,
    identityMissing: false,
  } satisfies TaskInput;

  it("envois suspendus : alerte urgente lisible", () => {
    const [task] = buildTasks({ ...base, emails: { blockedLabel: "La clé Brevo n'est pas reconnue", toReview: 1 } });
    expect(task).toMatchObject({ key: "emails-blocked", priority: "urgent", href: "/admin/notifications#emails" });
    expect(task!.detail).toContain("La clé Brevo n'est pas reconnue");
  });

  it("messages à reprendre, puis plus rien quand tout est réglé", () => {
    expect(buildTasks({ ...base, emails: { blockedLabel: null, toReview: 2 } })[0]).toMatchObject({ key: "emails-review", title: "2 e-mails à vérifier" });
    expect(buildTasks({ ...base, emails: { blockedLabel: null, toReview: 0 } })).toEqual([]);
  });
});

describe("séparation des secrets", () => {
  const read = (path: string) => readFileSync(path, "utf8");

  it("le code de connexion (SMTP Supabase) ne passe pas par l'API Brevo de l'application", () => {
    const otp = read("src/lib/auth/otp.ts");
    expect(otp).not.toMatch(/email\/(outbox|delivery|health)|brevo/i);
  });

  it("la clé Brevo reste côté serveur", () => {
    expect(read("src/lib/email/outbox.ts")).toMatch(/^import "server-only";/);
    expect(read("src/lib/email/health.ts")).toMatch(/^import "server-only";/);
    expect(read("src/lib/email/delivery.ts")).not.toMatch(/process\.env|serverEnv/);
    expect(read("src/lib/env.ts")).not.toMatch(/NEXT_PUBLIC_[A-Z_]*BREVO/);
  });
});
