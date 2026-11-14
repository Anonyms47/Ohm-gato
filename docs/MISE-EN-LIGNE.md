# Mise en ligne

## Déjà fait

- Projet Supabase de production **ohmegato** (région Paris), `https://yezbldzopolukdxpninr.supabase.co`.
- Tables, sécurité (RLS), fonctions, espaces de stockage et vrai catalogue (8 produits, prix, parfums, conservation). Aucune donnée de test.

## 1. Dernière étape de la base (une fois)

1. Ouvrir `docs/production/finalize.sql` sur GitHub, bouton « Raw », tout copier.
2. Supabase → projet **ohmegato** → **SQL Editor** → coller → **Run**.

Ces instructions contiennent des suppressions techniques (nettoyage, contraintes) que le connecteur ne peut pas passer sans confirmation.

## 2. Héberger le site sur Vercel

1. Créer un compte sur vercel.com avec GitHub, puis **Add New → Project** → importer `Anonyms47/Ohm-gato`.
2. Avant « Deploy », ouvrir **Environment Variables** et ajouter :

| Nom | Valeur |
|---|---|
| `APP_ENV` | `production` |
| `NEXT_PUBLIC_SITE_URL` | l'adresse Vercel du site (ex. `https://ohm-gato.vercel.app`) |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://yezbldzopolukdxpninr.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_PF2XR4xWRIx8YsCzXDrKng_kU-Errgi` |
| `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API Keys → clé **secret** (`sb_secret_…`), à ne jamais publier |
| `TRACKING_TOKEN_SECRET` | la valeur secrète transmise dans la conversation (64 caractères) |
| `PAYMENT_TEST_MODE` | `false` |
| `OTP_TEST_MODE` | `false` |
| `WAVE_PAYMENT_LINK` | `https://pay.wave.com/m/M_sn_qG-azdQrGkds/c/sn/` |

3. **Deploy**. Si l'adresse finale diffère de `NEXT_PUBLIC_SITE_URL`, corriger la variable puis **Redeploy**.

## 3. Réglages de connexion dans Supabase

- **Authentication → URL Configuration** : *Site URL* = l'adresse du site.
- **Authentication → Email Templates → Magic Link** : sujet « Votre code OHMEGATO » et corps contenant le code :

  ```html
  <h2>Votre code OHMEGATO</h2>
  <p>Saisissez ce code sur la page « Retrouvons votre carnet » :</p>
  <p style="font-size:28px;letter-spacing:6px"><strong>{{ .Token }}</strong></p>
  <p>Valable 10 minutes, utilisable une seule fois.</p>
  ```

  Faire de même pour le modèle **Confirm signup**.
- **Authentication → Providers → Email** : laisser activé.
- Téléphone : à activer quand le compte WhatsApp Business sera prêt (voir `docs/INTEGRATIONS.md`). D'ici là, la connexion se fait par e-mail.

Limite connue : sans SMTP personnel, Supabase n'envoie que quelques e-mails par heure. Commander ne nécessite pas de compte ; pour ouvrir largement les comptes clients, brancher un SMTP (Resend, Brevo…).

## 4. Premier accès d'Alima à /admin

1. Alima se connecte une fois sur `/connexion` avec son e-mail.
2. Lui donner le rôle administrateur (Supabase → SQL Editor) :

   ```sql
   insert into public.staff_roles (user_id, role)
   select id, 'admin' from auth.users where email = 'ADRESSE_D_ALIMA';
   ```

3. Dans `/admin` → **Fournées** : créer la première fournée, ses produits, son stock et ses créneaux, puis **Ouvrir les commandes**.

## Mise à jour : charte, zones, paiements, alertes, commandes permanentes (ordre à respecter)

1. **Avant le déploiement du code** (Supabase → SQL Editor, ou connecteur) : appliquer dans l'ordre les migrations `20261029000001`, `20261029000002`, `20261029000003`, puis `20261114000001_permanent_orders.sql`. Aucune donnée n'est supprimée ; chaque migration a son retour arrière dans `supabase/rollbacks/`.
2. Publier les textes légaux : `supabase/seed/legal-publish-1.2.sql` puis `supabase/seed/legal-publish-1.3.sql` (rejouables). Les preuves d'acceptation déjà enregistrées restent valables.
3. Vérifier dans l'atelier qu'une fournée est **ouverte avec une date de livraison à venir** (sinon les clientes ne peuvent pas valider : alerte « Aucune fournée n'est ouverte aux commandes »).
4. Déployer le code (aperçu Vercel d'abord, puis production après validation).
5. Retour arrière du code : redéployer la version précédente ; les migrations sont rétrocompatibles (colonnes ajoutées, fonctions remplaçables par les fichiers `.down.sql`).
