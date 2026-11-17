/**
 * Données de marque stables. Les données éditables (message de fournée, note d'Alima…)
 * vivent en base (site_settings) et s'administrent depuis /admin.
 */
export const brand = {
  name: "OHMEGATO",
  city: "Dakar",
  email: "contact@ohmegato.com",
  phoneDisplay: "+221 78 010 30 50",
  phoneE164: "+221780103050",
  whatsappUrl: "https://wa.me/221780103050",
  instagramHandle: "ohmegato",
  instagramUrl: "https://www.instagram.com/ohmegato/",
  pickupAddress: "Rue GY-69, Cité Sonatel 2, Sud Foire",
  /**
   * Logos officiels de l'agence, en vecteur (SVG vectorisés depuis les fichiers fournis : symbole muffin/Ω avec losange rose,
   * logotype manuscrit). Ne jamais redessiner, déformer ni retaper ; fonds clairs uniquement (aucune version inversée fournie).
   */
  symbol: { src: "/brand/symbole-ohmegato.svg", png: "/brand/symbole-ohmegato.png", width: 1000, height: 1761 },
  logotype: { src: "/brand/logotype-ohmegato.svg", png: "/brand/logotype-ohmegato.png", width: 1800, height: 597 },
} as const;
