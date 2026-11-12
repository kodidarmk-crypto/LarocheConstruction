# Laroche Construction — paquet de travail final

Site multi-pages Next.js/Vercel avec HTML conservé sous `public/`, une seule feuille globale `public/Style/style.css`, API serveur dans `lib/shared.js`, stockage Supabase et tableau admin protégé.

## À faire dans l’ordre

1. **Sauvegarder** le projet et le Supabase existants.
2. **Exécuter le SQL** `supabase/schema.sql` dans Supabase SQL Editor et créer le premier admin selon [`docs/SUPABASE-EDITEUR.md`](docs/SUPABASE-EDITEUR.md).
3. **Copier les fichiers dans votre dépôt GitHub**, en gardant `.env.example` et sans ajouter de vrai `.env`.
4. **Configurer Vercel** (Node 22+) avec les variables décrites dans [`docs/VERCEL-ET-INTEGRATIONS.md`](docs/VERCEL-ET-INTEGRATIONS.md), puis redéployer.
5. **Vérifier les routes** dans [`docs/ROUTES-API.md`](docs/ROUTES-API.md) et tester `/api/health`, la page admin, les actualités, plans et médias.
6. **Tester les fournisseurs en mode test** (Google Apps Script, Telegram, Monetbil, YouTube) avant les paiements réels.
7. Acheter/configurer plus tard le domaine et mettre à jour l’URL de callback Monetbil.

## Commandes

```bash
npm ci
npm test
npm run build
npm start
```

L’admin web se trouve à `/page/admin.html`. Il utilise un compte Supabase Auth préautorisé avec un PIN séparé à six chiffres. Il n’existe volontairement pas de formulaire public de création de compte admin. L’application Visual Basic Windows et sa source sont dans `admin-desktop/`; voir [`docs/ADMIN-WINDOWS.md`](docs/ADMIN-WINDOWS.md). Le `.exe` x64 est autonome .NET et nécessite Microsoft Edge WebView2 Runtime.

## Fichiers principaux

- `public/Style/style.css` : feuille de style centrale, partagée par les pages.
- `public/page/*.html` : pages statiques.
- `public/JS/*.js` : navigation, catalogue, formulaires, vidéos et admin.
- `lib/shared.js` : routes serveur, auth admin et intégrations.
- `lib/supabase.js` : clients Supabase.
- `lib/email.js`, `google-apps-script/Code.gs` : envoi des pièces jointes PDF avec Gmail.
- `supabase/schema.sql` : schéma PostgreSQL complet et politiques.
- `.env.example` : liste des noms de variables seulement, sans valeurs.

## État de validation

Contrôles réussis : `npm test` (20 tests), `npm run build`, `npm audit` (0 vulnérabilité signalée), analyse syntaxique CSS/PostgreSQL, 19 pages HTML contrôlées sans chemin local cassé, et réponses HTTP 200 pour `/`, `/api/health`, `/page/admin.html` et `/Style/style.css`. Le schéma d’alignement a été appliqué et vérifié sur le projet Supabase Laroche existant; les lignes d’entreprise et d’admin ont été conservées. Des abonnés historiques n’ont pas de métadonnées de consentement : aucune preuve n’a été inventée; reconfirmez leur consentement avant de leur envoyer du marketing. Le `.exe` a été compilé pour Windows x64. Les tests locaux simulent les fournisseurs et ne contactent pas de vraies clés ni de vraies API. Les secrets Vercel et les essais réels de Telegram, Google Apps Script/Gmail, Monetbil et YouTube restent à configurer/vérifier; le statut du déploiement Vercel n’est pas confirmé. SASPay et l’achat du domaine ne sont pas inclus.
