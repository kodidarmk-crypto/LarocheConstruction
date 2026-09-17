-- Laroche Construction / Supabase schema
-- Execute this script in Supabase SQL Editor with the database owner role.
-- Never place SUPABASE_SERVICE_ROLE_KEY, Monetbil secrets, or Telegram tokens
-- in the frontend. The server must use the service role only in Vercel Functions.

create extension if not exists pgcrypto;
create extension if not exists citext;

create schema if not exists private;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- The PIN is an additional factor for the private admin backend.
-- Only a bcrypt hash is stored; never store the raw PIN.
create table if not exists private.admin_pin_credentials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pin_hash text not null check (pin_hash like '$2%'),
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  changed_at timestamptz not null default now(),
  last_verified_at timestamptz
);

create table if not exists public.site_stats (
  id boolean primary key default true check (id),
  projects integer not null default 0 check (projects >= 0),
  experience integer not null default 0 check (experience >= 0),
  collaborators integer not null default 0 check (collaborators >= 0),
  cities integer not null default 0 check (cities >= 0),
  clients integer not null default 0 check (clients >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  key text primary key check (key ~ '^[a-z][a-z0-9_.-]{1,80}$'),
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 160),
  type text not null check (type in ('residential', 'commercial', 'industrial', 'civil')),
  surface text check (surface in ('under-100', '100-200', '200-300', 'over-300')),
  surfaces text[] not null default '{}',
  price bigint not null default 0 check (price >= 0),
  description text not null default '' check (char_length(description) <= 4000),
  cover_path text check (cover_path is null or char_length(cover_path) <= 500),
  pdf_path text check (pdf_path is null or char_length(pdf_path) <= 500),
  status text not null default 'published' check (status in ('published', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.news (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 220),
  category text not null default 'Actualité' check (char_length(category) <= 80),
  summary text not null default '' check (char_length(summary) <= 4000),
  content text not null default '',
  location text check (location is null or char_length(location) <= 180),
  image_path text,
  published_on date,
  status text not null default 'hidden' check (status in ('published', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  youtube_id text not null unique check (youtube_id ~ '^[A-Za-z0-9_-]{6,20}$'),
  title text not null default '' check (char_length(title) <= 220),
  description text not null default '',
  published_at timestamptz,
  views bigint not null default 0 check (views >= 0),
  status text not null default 'published' check (status in ('published', 'hidden')),
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.social_links (
  network text primary key check (network in ('facebook', 'instagram', 'linkedin', 'tiktok', 'youtube', 'x')),
  url text not null check (url ~* '^https://'),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  source text not null default 'website' check (source in ('website', 'plan-order', 'project-quiz', 'contact')),
  status text not null default 'active' check (status in ('active', 'unsubscribed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_leads (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (char_length(first_name) between 1 and 120),
  last_name text not null check (char_length(last_name) between 1 and 120),
  email citext not null,
  phone text not null check (char_length(phone) between 5 and 40),
  budget bigint check (budget is null or budget >= 0),
  estimate_amount bigint check (estimate_amount is null or estimate_amount >= 0),
  quiz jsonb not null default '{}'::jsonb,
  telegram_status text not null default 'pending' check (telegram_status in ('pending', 'sent', 'failed')),
  created_at timestamptz not null default now()
);

create table if not exists public.plan_orders (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 180),
  email citext not null,
  phone text not null check (char_length(phone) between 5 and 40),
  surface text check (char_length(surface) <= 80),
  requirements text not null default '' check (char_length(requirements) <= 4000),
  amount bigint not null check (amount >= 0),
  currency text not null default 'XAF' check (currency = 'XAF'),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'cancelled')),
  monetbil_transaction_id text unique,
  paid_at timestamptz,
  delivery_status text not null default 'pending' check (delivery_status in ('pending', 'sent', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'monetbil' check (provider = 'monetbil'),
  provider_event_id text not null unique,
  order_id uuid references public.plan_orders(id) on delete set null,
  event_type text not null,
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text
);

create index if not exists plans_public_sort_idx on public.plans (price asc, created_at desc) where status = 'published';
create index if not exists news_public_idx on public.news (published_on desc, created_at desc) where status = 'published';
create index if not exists videos_public_idx on public.videos (published_at desc) where status = 'published';
create index if not exists project_leads_created_idx on public.project_leads (created_at desc);
create index if not exists plan_orders_created_idx on public.plan_orders (created_at desc);

drop trigger if exists plans_updated_at on public.plans;
create trigger plans_updated_at before update on public.plans for each row execute function private.set_updated_at();
drop trigger if exists news_updated_at on public.news;
create trigger news_updated_at before update on public.news for each row execute function private.set_updated_at();
drop trigger if exists videos_updated_at on public.videos;
create trigger videos_updated_at before update on public.videos for each row execute function private.set_updated_at();
drop trigger if exists site_stats_updated_at on public.site_stats;
create trigger site_stats_updated_at before update on public.site_stats for each row execute function private.set_updated_at();
drop trigger if exists site_settings_updated_at on public.site_settings;
create trigger site_settings_updated_at before update on public.site_settings for each row execute function private.set_updated_at();
drop trigger if exists social_links_updated_at on public.social_links;
create trigger social_links_updated_at before update on public.social_links for each row execute function private.set_updated_at();
drop trigger if exists newsletter_updated_at on public.newsletter_subscribers;
create trigger newsletter_updated_at before update on public.newsletter_subscribers for each row execute function private.set_updated_at();
drop trigger if exists plan_orders_updated_at on public.plan_orders;
create trigger plan_orders_updated_at before update on public.plan_orders for each row execute function private.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (select 1 from public.admin_users where user_id = (select auth.uid()));
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function private.verify_admin_pin(
  requested_user_id uuid,
  requested_pin text
)
returns boolean
language plpgsql
security definer
set search_path = private, public, pg_catalog
as $$
declare
  credential private.admin_pin_credentials%rowtype;
  valid_pin boolean;
begin
  if requested_user_id is null
     or requested_pin is null
     or requested_pin !~ '^[0-9]{6}$' then
    return false;
  end if;

  select *
  into credential
  from private.admin_pin_credentials
  where user_id = requested_user_id
  for update;

  if not found or (credential.locked_until is not null and credential.locked_until > now()) then
    return false;
  end if;

  valid_pin := extensions.crypt(requested_pin, credential.pin_hash) = credential.pin_hash;

  if valid_pin then
    update private.admin_pin_credentials
    set failed_attempts = 0, locked_until = null, last_verified_at = now()
    where user_id = requested_user_id;
  else
    update private.admin_pin_credentials
    set failed_attempts = failed_attempts + 1,
        locked_until = case
          when failed_attempts + 1 >= 5 then now() + interval '15 minutes'
          else locked_until
        end
    where user_id = requested_user_id;
  end if;

  return valid_pin;
end;
$$;

create or replace function public.verify_admin_pin_public(
  requested_user_id uuid,
  requested_pin text
)
returns boolean
language sql
security definer
set search_path = private, public, pg_catalog
as $$
  select private.verify_admin_pin(requested_user_id, requested_pin);
$$;

revoke all on function public.verify_admin_pin_public(uuid, text) from public;
grant execute on function public.verify_admin_pin_public(uuid, text) to service_role;

revoke all on function private.verify_admin_pin(uuid, text) from public;
revoke all on function private.verify_admin_pin(uuid, text) from anon, authenticated;

alter table public.admin_users enable row level security;
alter table private.admin_pin_credentials enable row level security;
alter table public.site_stats enable row level security;
alter table public.site_settings enable row level security;
alter table public.plans enable row level security;
alter table public.news enable row level security;
alter table public.videos enable row level security;
alter table public.social_links enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.project_leads enable row level security;
alter table public.plan_orders enable row level security;
alter table public.payment_events enable row level security;

-- Public clients read only deliberately public projections. PDFs never appear here.
create or replace view public.public_plans
with (security_invoker = true)
as
select id, slug, name, type, surface, surfaces, price, description, cover_path, status, created_at, updated_at
from public.plans
where status = 'published';

create or replace view public.public_news
with (security_invoker = true)
as
select id, title, category, summary, content, location, image_path, published_on, created_at, updated_at
from public.news
where status = 'published';

create or replace view public.public_videos
with (security_invoker = true)
as
select id, youtube_id, title, description, published_at, views, created_at
from public.videos
where status = 'published';

create or replace view public.public_social_links
with (security_invoker = true)
as
select network, url
from public.social_links
where enabled;

grant select on public.public_plans, public.public_news, public.public_videos, public.public_social_links to anon, authenticated;

-- Policies are recreated below so this migration can safely be rerun.
drop policy if exists "admins manage admin users" on public.admin_users;
drop policy if exists "public reads stats" on public.site_stats;
drop policy if exists "public reads published plans" on public.plans;
drop policy if exists "public reads published news" on public.news;
drop policy if exists "public reads published videos" on public.videos;
drop policy if exists "public reads enabled social links" on public.social_links;
drop policy if exists "admins manage stats" on public.site_stats;
drop policy if exists "admins manage settings" on public.site_settings;
drop policy if exists "admins manage plans" on public.plans;
drop policy if exists "admins manage news" on public.news;
drop policy if exists "admins manage videos" on public.videos;
drop policy if exists "admins manage social links" on public.social_links;
drop policy if exists "public newsletter signup" on public.newsletter_subscribers;
drop policy if exists "admins manage newsletter" on public.newsletter_subscribers;
drop policy if exists "public submit project lead" on public.project_leads;
drop policy if exists "admins manage project leads" on public.project_leads;
drop policy if exists "admins manage orders" on public.plan_orders;
drop policy if exists "admins manage payment events" on public.payment_events;
drop policy if exists "admins manage private plan files" on storage.objects;

create policy "admins manage admin users" on public.admin_users for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select on public.site_stats to anon, authenticated;
grant select (id, slug, name, type, surface, surfaces, price, description, cover_path, status, created_at, updated_at) on public.plans to anon, authenticated;
grant select on public.news, public.videos, public.social_links to anon, authenticated;
create policy "public reads stats" on public.site_stats for select to anon, authenticated using (true);
create policy "public reads published plans" on public.plans for select to anon, authenticated using (status = 'published');
create policy "public reads published news" on public.news for select to anon, authenticated using (status = 'published');
create policy "public reads published videos" on public.videos for select to anon, authenticated using (status = 'published');
create policy "public reads enabled social links" on public.social_links for select to anon, authenticated using (enabled);
create policy "admins manage stats" on public.site_stats for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage settings" on public.site_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage plans" on public.plans for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage news" on public.news for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage videos" on public.videos for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage social links" on public.social_links for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "public newsletter signup" on public.newsletter_subscribers for insert to anon, authenticated with check (status = 'active' and email is not null);
create policy "admins manage newsletter" on public.newsletter_subscribers for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "public submit project lead" on public.project_leads for insert to anon, authenticated with check (email is not null);
create policy "admins manage project leads" on public.project_leads for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage orders" on public.plan_orders for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage payment events" on public.payment_events for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- No client role may read private order data, payment payloads, or PDF paths.
revoke all on public.admin_users, public.site_settings, public.plans, public.news, public.videos,
  public.social_links, public.project_leads, public.plan_orders, public.payment_events
  from anon;
revoke select on public.plan_orders, public.payment_events, public.project_leads from authenticated;
grant select (id, slug, name, type, surface, surfaces, price, description, cover_path, status, created_at, updated_at) on public.plans to anon, authenticated;
grant select on public.news, public.videos, public.social_links to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('plans-private', 'plans-private', false, 52428800, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 52428800, allowed_mime_types = excluded.allowed_mime_types;

create policy "admins manage private plan files"
on storage.objects for all to authenticated
using (bucket_id = 'plans-private' and public.is_admin())
with check (bucket_id = 'plans-private' and public.is_admin());

-- The backend must create a short-lived signed URL only after a paid order.
-- Do not add an anon SELECT policy to storage.objects for this bucket.

insert into public.site_stats (id) values (true) on conflict (id) do nothing;
