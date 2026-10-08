/**
 * Données de marque stables. Les données éditables (message de fournée, note d'Alima…)
 * vivent en base (site_settings) et s'administrent depuis /admin.
 */
export const brand = {
  name: "OHMEGATO",
  city: "Dakar",
  phoneDisplay: "+221 78 010 30 50",
  phoneE164: "+221780103050",
  whatsappUrl: "https://wa.me/221780103050",
  instagramHandle: "ohmegato",
  instagramUrl: "https://www.instagram.com/ohmegato/",
  pickupAddress: "Rue GY-69, Cité Sonatel 2, Sud Foire",
  /**
   * Logo officiel : déposer le fichier vectoriel dans public/brand/ puis renseigner
   * son chemin et ses dimensions ici. Tant qu'il vaut null, le nom s'affiche en
   * texte simple (aucune imitation du logo).
   */
  logo: null as null | { src: string; width: number; height: number },
} as const;
