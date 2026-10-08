# Intégrations

## Paiements

Couche d'adaptation : `src/lib/payments/`. Chaque fournisseur implémente `PaymentProviderAdapter` (création de session, vérification de webhook). Règles communes :

- le montant vient toujours de la commande en base, recalculé par `public.place_order` ;
- une commande provisoire (stock réservé 30 min) est créée **avant** la redirection ;
- seul un webhook signé change le statut ; un retour sur le site ne vaut jamais paiement ;
- `payment_events (provider, event_id)` est unique : un webhook répété n'a aucun effet ;
- un paiement reçu après expiration reprend le stock s'il en reste, sinon la commande passe en « à vérifier » ;
- sans identifiants, le bouton est désactivé et le client voit « Paiement temporairement indisponible ».

| Fournisseur | État | Variables |
|---|---|---|
| Test (`test`) | Terminé, hors production uniquement | `PAYMENT_TEST_MODE`, `PAYMENT_TEST_WEBHOOK_SECRET` |
| Wave | Écrit d'après la documentation publique Wave Checkout, **non vérifié** faute d'identifiants | `WAVE_API_KEY`, `WAVE_WEBHOOK_SECRET` |
| Orange Money | **Non implémenté** : l'API dépend du contrat marchand | `ORANGE_MONEY_*` |

Webhooks à déclarer chez les fournisseurs : `https://<domaine>/api/payments/webhook/wave` et `/api/payments/webhook/orange_money`.

Pour Wave, à valider avec le compte réel : format exact de l'en-tête `Wave-Signature`, noms des événements (`checkout.session.completed`, `checkout.session.payment_failed`), délai d'expiration des sessions.

## Carte et adresses

- Carte : Leaflet, tuiles OpenStreetMap par défaut (`NEXT_PUBLIC_MAP_TILE_URL`, `NEXT_PUBLIC_MAP_ATTRIBUTION`). Pour la production, utiliser un fournisseur de tuiles avec clé (MapTiler, Stadia…) : la politique d'usage des tuiles OSM publiques ne convient pas à un site commercial à fort trafic.
- La position n'est demandée qu'après un clic sur « Utiliser ma position ». La saisie manuelle reste toujours possible.
- **À faire** : recherche d'adresse (géocodage). Fournisseur à choisir ; Nominatim public ne convient pas en production.
- La position exacte est obligatoire pour une livraison ; elle est enregistrée avec la commande (`orders.latitude`, `orders.longitude`). Les frais de livraison se règlent au livreur : la table `delivery_zones` n'intervient plus dans le prix.

## Polices

Voir `src/styles/fonts.css`. Déposer `ohmegato-display.woff2` et `ohmegato-script.woff2` dans `public/fonts/`, décommenter les `@font-face`, puis modifier `--ohm-font-display` et `--ohm-font-script` dans `src/styles/tokens.css`. Tous les titres passent par `BrandHeading`.

## Logo

Logo vectoriel dans `public/brand/logo-ohmegato.svg`, vectorisé depuis le médaillon fourni (palette réduite aux couleurs d'origine). Les favicons sont dans `src/app/`. Si la marque fournit un jour le fichier source de son graphiste, il suffit de remplacer ce SVG.

## Photos produits

Les visuels actuels sont livrés avec le site (`public/products/`, chemins commençant par `/`). Les prochains pourront être téléversés dans le bucket Supabase `products` (public en lecture, écriture admin, 5 Mo max, WebP/AVIF/PNG/JPEG). Chaque image est déclarée dans `product_images` avec ses dimensions réelles et un texte alternatif. Le rôle `cutout` sert aux compositions.

## Déploiement

1. Créer un projet Supabase (région la plus proche de Dakar), puis `npx supabase link` et `npx supabase db push`.
2. Charger **uniquement** `supabase/seed/products.sql`. Ne jamais exécuter `dev.sql` en production.
3. Variables d'environnement : `APP_ENV=production`, `PAYMENT_TEST_MODE=false` (l'application refuse de démarrer sinon), `TRACKING_TOKEN_SECRET` unique, clés Supabase, identifiants de paiement.
4. Héberger Next.js derrière un proxy qui réécrit `X-Forwarded-For` (Vercel le fait) : la limitation de débit par IP en dépend.
5. Planifier `select public.expire_stale_orders()` toutes les 5 minutes (pg_cron) ; il est aussi appelé à chaque commande et à chaque consultation de suivi.
