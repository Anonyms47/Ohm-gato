import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => <img src={src} alt={alt} className={className} />,
}));

import { LoadingScreen } from "@/components/brand/LoadingScreen";

describe("écran de chargement", () => {
  it("annonce le chargement aux lecteurs d'écran et cache l'image décorative", () => {
    const html = renderToStaticMarkup(<LoadingScreen label="Ouverture de votre boîte…" size="section" />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Ouverture de votre boîte…");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('alt=""');
  });

  it("utilise le logotype officiel en SVG, animé par la classe de la charte", () => {
    const html = renderToStaticMarkup(<LoadingScreen />);
    expect(html).toContain("/brand/logotype-ohmegato.svg");
    expect(html).toContain("ohm-chargement");
    expect(html).toContain("Chargement…");
  });
});

describe("écran de chargement de page", () => {
  it("couvre tout l'écran : le pied de page et la page précédente ne sont jamais visibles", () => {
    const html = renderToStaticMarkup(<LoadingScreen />);
    expect(html).toContain("fixed");
    expect(html).toContain("inset-0");
    expect(html).toContain("min-h-dvh");
    expect(html).toContain("bg-creme");
  });

  it("l'écran de section reste dans la page", () => {
    const html = renderToStaticMarkup(<LoadingScreen size="section" />);
    expect(html).not.toContain("fixed");
  });
});
