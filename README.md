# OHMEGATO

Boutique en ligne d'OHMEGATO, pâtisseries faites maison à Dakar : commandes par fournées, livraison dans Dakar ou retrait à Sud Foire, paiement intégral par Wave ou Orange Money.

## Stack

- **Next.js 16** (App Router), **TypeScript strict**, **Tailwind CSS 4**
- **Supabase** : PostgreSQL, RLS, Storage (Auth et temps réel prévus pour l'espace membre)
- **Radix UI** (Select, Popover), **cmdk** (recherche), **vaul** (feuilles mobiles), entièrement restylés
- **Zod** (validations partagées navigateur / serveur), **React Hook Form**
- **Vitest** (unitaires), **pgTAP** (base de données), **Playwright** (parcours critiques)

## Démarrage

Prérequis : Node 22+, Docker (pour Supabase en local).

```bash
npm install
npm run db:start              # Supabase local (migrations + données de test)
cp .env.example .env.local    # puis compléter avec `npx supabase status`
npm run dev                   # http://localhost:3000
```

Dans `.env.local`, générer les secrets avec `openssl rand -hex 32` (`TRACKING_TOKEN_SECRET`, `PAYMENT_TEST_WEBHOOK_SECRET`) et laisser `PAYMENT_TEST_MODE=true` pour utiliser le paiement fictif.

## Vérifications

```bash
npm run lint && npm run typecheck
npm test                       # tests unitaires (prix, stock, paiement, statuts)
npx supabase test db           # tests de la base (commande, survente, webhooks, RLS)
npm run test:e2e               # parcours Playwright sur téléphone, tablette, ordinateur
```

`npm run test:e2e` réinitialise la base locale avant de démarrer (`E2E_SKIP_DB_RESET=1` pour l'éviter).

## Structure

```
src/app/                 Pages et routes API
  page.tsx               La Fournée (accueil)
  carte/                 La Carte et fiches produits
  ma-boite/              Ma boîte (panier)
  commande/              Le bon de fournée
  suivi/[token]/         Confirmation et suivi (lien personnel)
  paiement-test/         Fournisseur de paiement fictif (hors production)
  api/                   Commande, statut, reprise de paiement, webhooks
src/components/          Interface (ui/, brand/, catalog/, cart/, checkout/, order/)
src/lib/                 Logique métier (prix, stock, paiements, validations)
src/styles/              Tokens de marque et polices
supabase/migrations/     Schéma, RLS, fonctions transactionnelles
supabase/seed/           products.sql (catalogue réel) · dev.sql (données de TEST)
supabase/tests/          Tests pgTAP
tests/                   Tests unitaires et Playwright
docs/                    Intégrations, données à fournir, état d'avancement
```

## Documentation

- [docs/ETAT.md](docs/ETAT.md) : ce qui est terminé et ce qui reste à construire
- [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) : paiements, cartes, polices, déploiement
- [docs/DONNEES-A-FOURNIR.md](docs/DONNEES-A-FOURNIR.md) : informations qu'Alima doit encore transmettre

## Licence

Distribué sous licence MIT. Voir [LICENSE](LICENSE).
