import { describe, expect, it } from "vitest";
import { DEFAULT_EMAIL_FROM, parseSender } from "@/lib/email/sender";

describe("parseSender", () => {
  it("sépare le nom et l'adresse", () => {
    expect(parseSender(DEFAULT_EMAIL_FROM)).toEqual({ name: "OHMEGATO", email: "commandes@ohmegato.com" });
    expect(parseSender('"Atelier OHMEGATO" <contact@ohmegato.com>')).toEqual({ name: "Atelier OHMEGATO", email: "contact@ohmegato.com" });
  });

  it("accepte une adresse seule", () => {
    expect(parseSender(" contact@ohmegato.com ")).toEqual({ email: "contact@ohmegato.com" });
    expect(parseSender("<contact@ohmegato.com>")).toEqual({ email: "contact@ohmegato.com" });
  });
});
