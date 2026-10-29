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
   * Logo officiel en vecteur, vectorisé depuis le médaillon fourni par la marque
   * (palette d'origine conservée, aucun texte retapé).
   */
  logo: { src: "/brand/logo-ohmegato.svg", width: 640, height: 640 } as null | { src: string; width: number; height: number },
} as const;
