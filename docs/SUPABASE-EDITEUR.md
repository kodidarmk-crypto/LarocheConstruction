# Guide Supabase SQL Editor — Laroche Construction

Ce guide accompagne le schéma complet [`supabase/schema.sql`](../supabase/schema.sql). Il doit être exécuté dans le projet Supabase qui sera connecté à Vercel. Le script crée les tables, vues publiques, fonctions RPC, politiques RLS, politiques de Storage et buckets utilisés par le site.

## 1. Avant d’exécuter

1. Ouvrez le bon projet Supabase et vérifiez son nom/URL dans **Project Settings → General**.
2. Si le projet contient déjà des données, faites une sauvegarde avant toute modification. Le script est écrit pour être relançable en grande partie, mais il remplace certaines politiques/fonctions portant les noms définis par le site et crée/ajuste les buckets `plans-private` et `site-media`.
3. Téléchargez ou ouvrez `supabase/schema.sql`. N’y ajoutez jamais de clé privée, mot de passe, bot token ou valeur `.env`.

## 2. Exécuter le schéma

1. Dans Supabase, ouvrez **SQL Editor → New query**.
2. Copiez tout le contenu de `supabase/schema.sql` et collez-le dans l’éditeur.
3. Cliquez sur **Run**. Attendez la confirmation de fin. Si l’éditeur signale une erreur, arrêtez-vous sur la première erreur et ne déployez pas le site avant de l’avoir résolue.
4. Vérifiez dans **Table Editor** les tables `plans`, `news`, `newsletter_subscribers`, `social_links`, `site_settings`, `site_stats`, `plan_orders`, `project_request_receipts`, `analytics_events` et `admin_users`.
5. Vérifiez dans **Storage** les deux buckets : `site-media` doit être public pour les images; `plans-private` doit rester privé pour les PDF achetés.

Le schéma prévoit aussi les vues `public_plans`, `public_news`, `public_social_links`, `public_site_settings` et `public_site_stats`. Les visiteurs lisent les vues publiques; les tables privées et les écritures restent protégées par RLS et par les routes serveur. La vue des statistiques exclut les compteurs privés.

## 3. Créer le premier compte administrateur

Il n’y a volontairement **pas d’inscription admin publique**. Une page « créer mon admin » ouverte à tous permettrait à n’importe qui de prendre le contrôle du site. La création du premier administrateur se fait donc manuellement par le propriétaire du projet.

1. Dans **Authentication → Users**, invitez l’adresse email du client ou créez son utilisateur. Définissez son mot de passe initial via Supabase Auth.
2. Dans **SQL Editor**, exécutez le bloc ci-dessous après avoir remplacé l’adresse et le PIN temporaire. Le PIN doit contenir exactement six chiffres. Ne gardez pas les exemples ci-dessous.

```sql
do $$
declare
  admin_id uuid;
  admin_email text := lower('admin@votre-domaine.com');
  temporary_pin text := '482916'; -- À remplacer avant exécution
begin
  select id into admin_id
  from auth.users
  where lower(email) = admin_email
  limit 1;

  if admin_id is null then
    raise exception 'Aucun utilisateur Auth ne correspond à %', admin_email;
  end if;
  if temporary_pin !~ '^[0-9]{6}$' then
    raise exception 'Le PIN doit contenir exactement six chiffres';
  end if;

  insert into public.admin_users (user_id)
  values (admin_id)
  on conflict (user_id) do nothing;

  insert into private.admin_pin_credentials (user_id, pin_hash, failed_attempts, locked_until, changed_at)
  values (
    admin_id,
    extensions.crypt(temporary_pin, extensions.gen_salt('bf', 12)),
    0,
    null,
    now()
  )
  on conflict (user_id) do update
    set pin_hash = excluded.pin_hash,
        failed_attempts = 0,
        locked_until = null,
        changed_at = now();
end $$;
```

3. Le client se connecte à `/page/admin.html` avec **email + mot de passe Supabase Auth + PIN à six chiffres**. Après cinq PIN incorrects, le PIN est temporairement verrouillé.
4. Ne partagez pas le script SQL contenant le PIN. Le hash stocké est bcrypt; le PIN en clair n’est jamais envoyé au navigateur ni stocké dans la base. Si vous changez le PIN, mettez à jour la ligne de `private.admin_pin_credentials` avec le même appel `extensions.crypt(..., extensions.gen_salt('bf',12))`.

## 4. Contrôles SQL après exécution

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'plans', 'news', 'newsletter_subscribers', 'social_links', 'site_settings',
    'site_stats', 'plan_orders', 'project_request_receipts', 'analytics_events', 'admin_users'
  )
order by table_name;

select id, public, file_size_limit
from storage.buckets
where id in ('site-media', 'plans-private')
order by id;

select * from public.site_stats;
```

`site_stats` doit contenir une ligne (`id = true`). Vous pouvez ensuite saisir les chiffres réels du site via le tableau admin.

## 5. Règles de sécurité et données

- N’ajoutez pas de politique `SELECT` publique sur `plans-private` ou sur les tables admin, commandes, abonnés ou identifiants PIN.
- Le PDF est téléversé dans le bucket privé. La route serveur ne le transmet par email qu’après paiement confirmé (ou pour une commande gratuite validée).
- Les demandes de devis ne stockent pas les coordonnées dans Supabase : seule une empreinte HMAC, avec une durée d’idempotence, est conservée pour éviter les doubles envois et compter les demandes. Les coordonnées sont transmises par le backend à Telegram.
- La mesure d’audience utilise un identifiant aléatoire de navigateur, sans adresse IP. Elle reste indicative (un navigateur effacé ou un autre appareil compte séparément) et conserve au plus 400 jours d’événements lors des nouvelles écritures.
- Les nouveaux abonnements exigent un consentement explicite et stockent sa date, sa source et sa version. Les enregistrements historiques sont conservés, mais le schéma ne leur invente pas de preuve de consentement; vérifiez leur autorisation avant tout email marketing et demandez une nouvelle confirmation si nécessaire. Ne les exportez pas vers un espace public.

## 6. Fonctionnalités des tables

Le schéma couvre les plans PDF et caractéristiques, news et images, liens sociaux (Facebook, Instagram, TikTok, LinkedIn, X, YouTube), paramètres et coordonnées de l’entreprise, statistiques du site, newsletter, commandes/paiements, traces de notifications, idempotence des devis et statistiques anonymisées. YouTube est lu directement via l’API YouTube Data v3; les vidéos ne sont pas une copie de base de données. SASPay n’est pas intégré dans cette version.
