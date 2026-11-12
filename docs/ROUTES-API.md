# Routes API — matrice de vérification

Toutes les routes sont dispatchées via `app/api/[...path]/route.ts` vers `lib/shared.js`. Les méthodes non prévues retournent une erreur. Les routes admin exigent une session HttpOnly signée, authentifiée par Supabase Auth + PIN, et les mutations vérifient l’origine du site.

## Routes publiques

| Route | Méthode | Utilisation / contrôle |
|---|---|---|
| `/api/health` | GET | Santé du serveur, sans secret. |
| `/api/public/stats` | GET | Chiffres publics depuis Supabase. |
| `/api/public/site-settings` | GET | Coordonnées autorisées seulement via vue publique. |
| `/api/public/social-links` | GET | Liens activés uniquement via vue publique. |
| `/api/public/plans` | GET | Plans publiés via vue publique; le PDF reste privé. |
| `/api/public/news` | GET | Actualités publiées; une panne Supabase renvoie `503`, pas une liste vide fictive. |
| `/api/public/news/:uuid` | GET | Détail d’une actualité publiée; UUID vérifié et réponse `404` si absent. |
| `/api/public/videos` | GET | YouTube Data API côté serveur; erreur visible si non configurée. |
| `/api/public/analytics` | POST | Événements anonymisés `page_view`/`plan_view`, validation stricte des chemins/UUID. |
| `/api/public/order-status?order_id=:uuid` | GET | Retourne seulement le statut et l’état de livraison; aucune coordonnée client. |
| `/api/newsletter/subscribe` | POST | Email normalisé, consentement explicite requis; stockage séparé de Telegram. |
| `/api/project-leads` | POST | Validation des coordonnées/montants, HMAC d’idempotence, notif Telegram serveur; coordonnées non persistées en base. |
| `/api/plan-orders` | POST | Prix lu depuis la base, commande UUID, création Monetbil ou voie gratuite séparée; consentement newsletter facultatif. |
| `/api/monetbil/notify` | GET, POST | Callback signé uniquement; validation service, ordre, plan, montant/devise/transaction et transition atomique. |
| `/api/plans/download?order_id=:uuid` | GET | Route privée legacy réservée à l’admin; vérifie une commande payée avant URL signée. |

## Routes administrateur

| Route | Méthode | Contrôle / effet |
|---|---|---|
| `/api/admin/login` | POST | Auth Supabase email/mot de passe + PIN 6 chiffres, limitation des tentatives, cookie HttpOnly. |
| `/api/admin/session` | GET | Vérifie la session signée. |
| `/api/admin/logout` | POST | Expire le cookie admin. |
| `/api/admin/plans` | GET, POST | Lecture; création après validation du type, prix, caractéristiques et PDF privé. |
| `/api/admin/plans/:uuid` | PUT, DELETE | Modifier/masquer/supprimer un plan; PDF privé conservé si aucun nouveau fichier. |
| `/api/admin/news` | GET, POST | Lecture/création de news, champs validés. |
| `/api/admin/news/:uuid` | PUT, DELETE | Modifier/masquer/supprimer une news. |
| `/api/admin/stats` | GET, PUT | Chiffres de marque éditables. |
| `/api/admin/analytics` | GET | Statistiques jour/semaine/mois/année, vues plans et achats. |
| `/api/admin/settings` | GET, PUT | Coordonnées autorisées `email`, `phone`, `address`, `whatsapp`; clés inconnues ignorées et valeurs validées. |
| `/api/admin/social-links` | GET, PUT | Réseaux autorisés Facebook/Instagram/LinkedIn/TikTok/YouTube/X; URLs normalisées/validées. |
| `/api/admin/videos` | GET | Catalogue YouTube pour consultation admin. |
| `/api/admin/orders` | GET | Commandes et état de livraison, PII réservé à l’admin. |
| `/api/admin/orders/:uuid/deliver` | POST | Renvoi du PDF seulement pour une commande payée. |
| `/api/admin/newsletter/subscribers` | GET | Liste des inscrits réservée à l’admin. |
| `/api/admin/newsletter/subscribers/:uuid` | PATCH | Désinscrire un contact. |
| `/api/admin/uploads/sign` | POST | Crée un upload signé après validation admin, type MIME, taille et bucket. |

## Vérifications réalisées dans le paquet

- `npm test` : 20 tests couvrant consentement newsletter, envoi Google Apps Script simulé, devis/idempotence, signature Monetbil, échec de lien de paiement, vue publique des statistiques, catalogue YouTube et absence de données fictives.
- `npm run check` : syntaxe Node des scripts livrés et TypeScript.
- `npm run build` : build Next/Vercel.
- `npm audit` : contrôle de vulnérabilités des dépendances verrouillées.

Ces tests simulent les réponses des fournisseurs. Ils ne valident pas une vraie connexion à Supabase, un paiement Monetbil réel, un message Telegram ou un email Gmail. Ceux-ci doivent être testés avec vos comptes/configurations et en mode test fournisseur avant mise en production.
