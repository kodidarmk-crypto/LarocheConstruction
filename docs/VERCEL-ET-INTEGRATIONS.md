# Déploiement Vercel et configuration des intégrations

## Ordre recommandé

1. Exécutez et contrôlez `supabase/schema.sql` en suivant [`SUPABASE-EDITEUR.md`](SUPABASE-EDITEUR.md), puis créez au moins un utilisateur admin.
2. Dans Vercel, importez le dépôt GitHub et choisissez **Next.js**. La version Node requise est **22 ou plus**. Les scripts sont `npm run build`, `npm start`, `npm test`.
3. Dans **Project → Settings → Environment Variables**, renseignez les clés ci-dessous pour Production et, si besoin, Preview. Faites un redeploy après ajout/modification des variables.
4. Testez `/api/health`, ouvrez `/page/admin.html`, connectez-vous et vérifiez plans/news/settings. Faites les tests fournisseurs en mode test/sandbox avant de recevoir des paiements réels.

Le fichier `.env.example` est un modèle vide. Ne mettez pas `.env`, clés secrètes ou valeurs de production dans GitHub ou dans le code du navigateur.

## Variables d’environnement Vercel

| Variable | Obligatoire | Description |
|---|---:|---|
| `SUPABASE_URL` | Oui | URL du projet, par ex. `https://<project-ref>.supabase.co`. |
| `SUPABASE_PUBLISHABLE_KEY` | Oui | Clé publique/publishable Supabase; utilisée seulement côté serveur avec les vues publiques et côté navigateur pour l’upload signé. Elle n’accorde pas les droits admin. |
| `SUPABASE_SECRET_KEY` | Oui | Clé secrète Supabase réservée aux routes serveur Vercel. Ne jamais la préfixer par `NEXT_PUBLIC_`. Les anciens noms `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont encore acceptés comme compatibilité, mais ne sont pas recommandés. |
| `ADMIN_SESSION_SECRET` | Oui | Secret aléatoire de 32 caractères ou plus pour signer les sessions et le HMAC des demandes. Générez-le avec `python3 -c "import secrets; print(secrets.token_urlsafe(48))"`. Gardez la même valeur lors d’un redeploy; la remplacer invalide les sessions et empreintes d’idempotence en cours. |
| `TELEGRAM_BOT_TOKEN` | Pour devis/alertes | Jeton du bot fourni par BotFather. Serveur uniquement. |
| `TELEGRAM_CHAT_ID` | Pour devis/alertes | ID du compte, groupe ou canal recevant les messages. Démarrez une conversation avec le bot ou ajoutez-le au groupe/canal avec les droits nécessaires. |
| `GOOGLE_APPS_SCRIPT_URL` | Pour envoi email | URL Web App Google Apps Script complète, de forme `https://script.google.com/macros/s/<deployment-id>/exec`. |
| `GOOGLE_APPS_SCRIPT_TOKEN` | Pour envoi email | Jeton aléatoire de 32 caractères ou plus. Définissez la même valeur dans **Apps Script → Project Settings → Script Properties**, nom `LAROCHE_APPS_SCRIPT_TOKEN`. |
| `YOUTUBE_API_KEY` | Pour vidéos | Clé YouTube Data API v3, restreinte dans Google Cloud à YouTube Data API v3 et si possible à l’IP/usage serveur lorsque cela est compatible avec Vercel. Elle n’est jamais renvoyée au navigateur. |
| `YOUTUBE_CHANNEL_ID` | Pour vidéos | ID de chaîne YouTube (`UC…`), pas le nom `@handle`. |
| `MONETBIL_SERVICE_KEY` | Pour paiements | Identifiant de service Monetbil. |
| `MONETBIL_SECRET_KEY` | Pour paiements | Secret de signature Monetbil utilisé pour valider le callback. |
| `MONETBIL_NOTIFY_URL` | Pour paiements | URL publique complète du callback du projet, par ex. `https://<domaine>/api/monetbil/notify`. Elle doit être en HTTPS et pointer vers cette route. |

`NODE_ENV` et `VERCEL` sont fournis par la plateforme. `PORT` ne sert qu’au serveur local. `SUPABASE_DB_URL` et `GOOGLE_APPS_SCRIPT_DEPLOYMENT_ID` ne sont pas nécessaires et ont été retirés du modèle.

## Google Apps Script / Gmail

1. Ouvrez `google-apps-script/Code.gs` dans un projet Apps Script, enregistrez, puis dans **Project Settings → Script Properties**, ajoutez `LAROCHE_APPS_SCRIPT_TOKEN` avec le même secret que Vercel.
2. Dans **Deploy → New deployment → Web app**, exécutez comme le compte propriétaire qui possède l’autorisation Gmail. Autorisez l’accès Web App requis pour le serveur. L’endpoint est protégé par le jeton partagé; ne publiez jamais ce jeton.
3. Copiez l’URL `/exec` dans `GOOGLE_APPS_SCRIPT_URL`, puis redéployez Vercel.
4. Le backend envoie un message et les pièces jointes PDF en base64, pas une URL de fichier arbitraire. Limite actuelle : 3 pièces jointes PDF, 20 Mo au total. Gmail/Apps Script applique aussi ses quotas d’envoi.
5. L’envoi d’un plan payant n’est tenté qu’après la transition de paiement confirmée en base. Un échec d’email ne transforme pas le paiement en échec; l’admin affiche l’état de livraison et permet de renvoyer le PDF.

## Telegram

1. Créez un bot avec BotFather, récupérez son token et configurez `TELEGRAM_BOT_TOKEN`.
2. Envoyez `/start` au bot (ou ajoutez-le au groupe/canal cible) et renseignez le `chat_id` correspondant dans `TELEGRAM_CHAT_ID`.
3. Les demandes d’estimation et notifications partent du serveur. Le navigateur ne reçoit jamais le token. La fonction traite les erreurs et les réponses Telegram non confirmées; elle n’invente pas un succès.
4. La route `/api/project-leads` ne conserve pas les coordonnées des prospects dans Supabase. En cas de panne du compteur/idempotence Supabase, elle répond `503` plutôt que d’envoyer un doublon non contrôlé.

## YouTube

Activez **YouTube Data API v3** dans Google Cloud, créez une clé, puis renseignez l’ID de chaîne et la clé. La route `/api/public/videos` interroge YouTube côté serveur, met en cache brièvement les résultats et affiche une erreur explicite quand la clé/chaîne est indisponible. Un résultat vide reste vide (pas de vidéos d’exemple). Les utilisateurs ouvrent une vidéo dans un lecteur intégré YouTube et peuvent aussi la lire sur YouTube.

## Monetbil

Le frontend envoie un identifiant de plan et les coordonnées de commande à `/api/plan-orders`; le prix est relu depuis Supabase et n’est jamais accepté comme montant fiable depuis le navigateur. Le backend crée le lien Monetbil v2.1, enregistre une commande en attente, puis reçoit `/api/monetbil/notify`.

Le callback est signé, vérifié côté serveur, rapproché de la commande, du plan, du montant et de la devise, puis appliqué atomiquement via `apply_monetbil_payment`. Le simple retour du navigateur ne confirme pas un paiement. Une commande gratuite est livrée via la voie distincte qui ne contacte pas Monetbil. Ne basculez pas en production avant un test de paiement et de callback avec votre compte Monetbil. Le code attend une notification signée avec statut normalisé `success`, `failed` ou `cancelled`, devise `XAF`, et référence de commande/plan UUID; vérifiez ces champs avec le contrat et le mode test de votre compte fournisseur.

SASPay est seulement une piste future mentionnée dans les consignes; il n’existe pas d’intégration de secours active et le site ne prétend pas qu’elle fonctionne.

## Domaine personnalisé futur

Quand `larocheconstruction.com` sera acquis, ajoutez-le à **Vercel → Settings → Domains**, validez le DNS/TLS, puis mettez à jour `MONETBIL_NOTIFY_URL` avec `https://larocheconstruction.com/api/monetbil/notify`. Testez aussi l’envoi email, le callback Monetbil, les retours de commande, l’admin et les chemins d’images sous le nouveau domaine.
