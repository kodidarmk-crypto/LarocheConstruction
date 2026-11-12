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
  project_requests bigint not null default 0 check (project_requests >= 0),
  updated_at timestamptz not null default now()
);
alter table public.site_stats
  add column if not exists project_requests bigint not null default 0 check (project_requests >= 0);

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
  characteristics jsonb not null default '{}'::jsonb,
  cover_path text check (cover_path is null or char_length(cover_path) <= 500),
  pdf_path text check (pdf_path is null or char_length(pdf_path) <= 500),
  status text not null default 'published' check (status in ('published', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plans_characteristics_object check (jsonb_typeof(characteristics) = 'object')
);

alter table public.plans add column if not exists characteristics jsonb not null default '{}'::jsonb;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.plans'::regclass
      and conname = 'plans_characteristics_object'
  ) then
    alter table public.plans
      add constraint plans_characteristics_object
      check (jsonb_typeof(characteristics) = 'object') not valid;
  end if;
end;
$$;

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
  consented_at timestamptz,
  consent_source text,
  consent_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint newsletter_active_requires_consent
    check (status <> 'active' or (consented_at is not null and consent_source is not null and consent_version is not null))
);
alter table public.newsletter_subscribers add column if not exists consented_at timestamptz;
alter table public.newsletter_subscribers add column if not exists consent_source text;
alter table public.newsletter_subscribers add column if not exists consent_version text;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.newsletter_subscribers'::regclass
      and conname = 'newsletter_active_requires_consent'
  ) then
    -- Keep historical rows untouched; the constraint applies to new/updated rows.
    alter table public.newsletter_subscribers
      add constraint newsletter_active_requires_consent
      check (status <> 'active' or (consented_at is not null and consent_source is not null and consent_version is not null))
      not valid;
  end if;
end;
$$;

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

create table if not exists public.project_request_receipts (
  request_hash text primary key check (request_hash ~ '^[a-f0-9]{64}$'),
  status text not null check (status in ('processing', 'sent', 'failed')),
  created_at timestamptz not null,
  expires_at timestamptz not null,
  counted_at timestamptz
);
alter table public.project_request_receipts add column if not exists counted_at timestamptz;
create index if not exists project_request_receipts_expiry_idx
  on public.project_request_receipts (expires_at);

create or replace function public.claim_project_request(p_request_hash text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_status text;
begin
  if p_request_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid request hash';
  end if;

  delete from public.project_request_receipts
  where expires_at <= now();

  insert into public.project_request_receipts (request_hash, status, created_at, expires_at)
  values (p_request_hash, 'processing', now(), now() + interval '24 hours')
  on conflict (request_hash) do update
    set status = 'processing',
        created_at = now(),
        expires_at = now() + interval '24 hours'
    where public.project_request_receipts.expires_at <= now()
       or public.project_request_receipts.status = 'failed'
  returning status into v_status;

  if found then
    return jsonb_build_object('claimed', true, 'status', v_status);
  end if;

  select status into v_status
  from public.project_request_receipts
  where request_hash = p_request_hash;

  return jsonb_build_object('claimed', false, 'status', v_status);
end;
$$;

create or replace function public.complete_project_request(p_request_hash text, p_sent boolean)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_status text;
  v_counted_at timestamptz;
begin
  select counted_at into v_counted_at
  from public.project_request_receipts
  where request_hash = p_request_hash and status = 'processing'
  for update;

  if not found then
    select status into v_status
    from public.project_request_receipts
    where request_hash = p_request_hash;
    return jsonb_build_object('finalized', false, 'status', v_status);
  end if;

  update public.project_request_receipts
  set status = case when p_sent then 'sent' else 'failed' end,
      counted_at = coalesce(counted_at, now())
  where request_hash = p_request_hash
    and status = 'processing'
  returning status into v_status;

  if v_counted_at is null then
    insert into public.site_stats (id, project_requests)
    values (true, 1)
    on conflict (id) do update
      set project_requests = public.site_stats.project_requests + 1;
  end if;

  return jsonb_build_object('finalized', true, 'status', v_status);
end;
$$;

create or replace function public.apply_monetbil_payment(
  p_payment_ref uuid,
  p_item_ref uuid,
  p_provider_event_id text,
  p_transaction_id text,
  p_amount bigint,
  p_currency text,
  p_status text,
  p_payload_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_order public.plan_orders%rowtype;
  v_event_id uuid;
  v_new_status text;
begin
  if p_provider_event_id is null or char_length(p_provider_event_id) not between 1 and 200
     or p_transaction_id is null or char_length(p_transaction_id) not between 1 and 200
     or p_payload_hash !~ '^[a-f0-9]{64}$'
     or p_status not in ('success', 'failed', 'cancelled')
     or p_currency <> 'XAF' or p_amount <= 0 then
    return jsonb_build_object('accepted', false, 'reason', 'invalid_notification');
  end if;

  select * into v_order
  from public.plan_orders
  where id = p_payment_ref
  for update;

  if not found
     or v_order.plan_id <> p_item_ref
     or v_order.amount <> p_amount
     or v_order.currency <> p_currency then
    return jsonb_build_object('accepted', false, 'reason', 'order_mismatch');
  end if;

  insert into public.payment_events (
    provider_event_id, order_id, event_type, payload_hash, processed_at
  )
  values (p_provider_event_id, v_order.id, p_status, p_payload_hash, now())
  on conflict (provider_event_id) do nothing
  returning id into v_event_id;

  if not found then
    return jsonb_build_object('accepted', true, 'duplicate', true, 'status', v_order.status, 'changed', false);
  end if;

  if v_order.status = 'pending' then
    update public.plan_orders
    set status = case p_status
          when 'success' then 'paid'
          when 'cancelled' then 'cancelled'
          else 'failed'
        end,
        paid_at = case when p_status = 'success' then now() else null end,
        monetbil_transaction_id = p_transaction_id
    where id = v_order.id
      and status = 'pending'
    returning status into v_new_status;
  end if;

  return jsonb_build_object(
    'accepted', true,
    'duplicate', false,
    'status', coalesce(v_new_status, v_order.status),
    'changed', v_new_status is not null
  );
end;
$$;

-- Minimal analytics: random visitor UUIDs from the browser, never IP addresses or contacts.
create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  visitor_id uuid not null,
  event_date date not null default current_date,
  event_type text not null check (event_type in ('page_view', 'plan_view')),
  page_path text not null check (char_length(page_path) between 1 and 180 and page_path like '/%' and position('..' in page_path) = 0),
  plan_id uuid references public.plans(id) on delete set null,
  hits integer not null default 1 check (hits > 0),
  created_at timestamptz not null default now(),
  check ((event_type = 'page_view' and plan_id is null) or (event_type = 'plan_view' and plan_id is not null))
);
create unique index if not exists analytics_page_unique
  on public.analytics_events(visitor_id, event_date, event_type, page_path) where plan_id is null;
create unique index if not exists analytics_plan_unique
  on public.analytics_events(visitor_id, event_date, event_type, plan_id) where plan_id is not null;
create index if not exists analytics_date_type_idx on public.analytics_events(event_date, event_type);

create or replace function public.record_site_analytics(
  p_visitor_id uuid,
  p_event_type text,
  p_page_path text,
  p_plan_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_visitor_id is null
     or p_event_type not in ('page_view', 'plan_view')
     or p_page_path is null or char_length(p_page_path) not between 1 and 180
     or p_page_path not like '/%' or position('..' in p_page_path) > 0
     or (p_event_type = 'page_view' and p_plan_id is not null)
     or (p_event_type = 'plan_view' and p_plan_id is null) then
    raise exception 'Invalid analytics event';
  end if;

  delete from public.analytics_events
  where event_date < current_date - 400;

  if p_event_type = 'page_view' then
    insert into public.analytics_events(visitor_id, event_date, event_type, page_path, plan_id, hits)
    values (p_visitor_id, current_date, p_event_type, p_page_path, null, 1)
    on conflict (visitor_id, event_date, event_type, page_path) where plan_id is null
    do update set hits = public.analytics_events.hits + 1;
  else
    insert into public.analytics_events(visitor_id, event_date, event_type, page_path, plan_id, hits)
    values (p_visitor_id, current_date, p_event_type, p_page_path, p_plan_id, 1)
    on conflict (visitor_id, event_date, event_type, plan_id) where plan_id is not null
    do update set hits = public.analytics_events.hits + 1;
  end if;
  return jsonb_build_object('recorded', true);
end;
$$;

create or replace function public.get_admin_dashboard_stats()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'visitors', jsonb_build_object(
      'today', (select count(distinct visitor_id) from public.analytics_events where event_type = 'page_view' and event_date = current_date),
      'week', (select count(distinct visitor_id) from public.analytics_events where event_type = 'page_view' and event_date >= current_date - 6),
      'month', (select count(distinct visitor_id) from public.analytics_events where event_type = 'page_view' and event_date >= current_date - 29),
      'year', (select count(distinct visitor_id) from public.analytics_events where event_type = 'page_view' and event_date >= current_date - 364)
    ),
    'plan_views', coalesce((
      select jsonb_agg(jsonb_build_object('plan_id', plan_id, 'name', name, 'type', type, 'views', views))
      from (
        select a.plan_id, max(p.name) as name, max(p.type) as type, sum(a.hits)::bigint as views
        from public.analytics_events a left join public.plans p on p.id = a.plan_id
        where a.event_type = 'plan_view' and a.event_date >= current_date - 364
        group by a.plan_id order by sum(a.hits) desc limit 10
      ) ranked_views
    ), '[]'::jsonb),
    'purchases_by_type', coalesce((
      select jsonb_agg(jsonb_build_object('type', type, 'purchases', purchases, 'amount', amount))
      from (
        select p.type, count(*)::bigint as purchases, sum(o.amount)::bigint as amount
        from public.plan_orders o join public.plans p on p.id = o.plan_id
        where o.status = 'paid' and o.created_at >= now() - interval '365 days'
        group by p.type order by count(*) desc
      ) ranked_purchases
    ), '[]'::jsonb),
    'paid_orders', (select count(*) from public.plan_orders where status = 'paid'),
    'pending_orders', (select count(*) from public.plan_orders where status = 'pending'),
    'failed_deliveries', (select count(*) from public.plan_orders where status = 'paid' and delivery_status = 'failed'),
    'project_requests', (select project_requests from public.site_stats where id = true)
  );
$$;

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
alter table public.project_request_receipts enable row level security;
alter table public.analytics_events enable row level security;

-- Public clients read only deliberately public projections. PDFs never appear here.
create or replace view public.public_plans
with (security_invoker = true)
as
select id, slug, name, type, surface, surfaces, price, description, cover_path, status, created_at, updated_at, characteristics
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

-- This owner-rights view exposes only approved public contact values, never secrets.
create or replace view public.public_site_settings
with (security_barrier = true)
as
select key, value
from public.site_settings
where key in ('email', 'phone', 'address', 'whatsapp');

-- The public view omits the private project_requests counter and the row identifier.
create or replace view public.public_site_stats
with (security_barrier = true)
as
select projects, experience, collaborators, cities, clients
from public.site_stats
where id = true;

grant select on public.public_plans, public.public_news, public.public_videos, public.public_social_links, public.public_site_settings, public.public_site_stats to anon, authenticated;
revoke all on function public.claim_project_request(text) from public, anon, authenticated;
revoke all on function public.complete_project_request(text, boolean) from public, anon, authenticated;
revoke all on function public.apply_monetbil_payment(uuid, uuid, text, text, bigint, text, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_project_request(text) to service_role;
grant execute on function public.complete_project_request(text, boolean) to service_role;
grant execute on function public.apply_monetbil_payment(uuid, uuid, text, text, bigint, text, text, text)
  to service_role;
revoke all on function public.record_site_analytics(uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.get_admin_dashboard_stats() from public, anon, authenticated;
grant execute on function public.record_site_analytics(uuid, text, text, uuid) to service_role;
grant execute on function public.get_admin_dashboard_stats() to service_role;

-- Policies are recreated below so this migration can safely be rerun.
drop policy if exists "admins manage admin users" on public.admin_users;
drop policy if exists "public reads published plans" on public.plans;
drop policy if exists "public reads published news" on public.news;
drop policy if exists "public reads published videos" on public.videos;
drop policy if exists "public reads enabled social links" on public.social_links;
drop policy if exists "public reads stats" on public.site_stats;
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
drop policy if exists "admins manage site media" on storage.objects;

create policy "admins manage admin users" on public.admin_users for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select (id, slug, name, type, surface, surfaces, price, description, cover_path, status, created_at, updated_at, characteristics) on public.plans to anon, authenticated;
grant select on public.news, public.videos, public.social_links to anon, authenticated;
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
create policy "admins manage newsletter" on public.newsletter_subscribers for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage project leads" on public.project_leads for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage orders" on public.plan_orders for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage payment events" on public.payment_events for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- No client role may read private order data, payment payloads, or PDF paths.
revoke all on public.admin_users, public.site_settings, public.plans, public.news, public.videos,
  public.social_links, public.project_leads, public.plan_orders, public.payment_events
  from anon;
revoke select on public.plan_orders, public.payment_events, public.project_leads from authenticated;
revoke insert on public.newsletter_subscribers, public.project_leads from anon, authenticated;
revoke all on public.project_request_receipts from anon, authenticated;
revoke select on public.site_stats from anon, authenticated;
revoke select (project_requests) on public.site_stats from anon, authenticated;
grant select (projects, experience, collaborators, cities, clients)
  on public.site_stats to anon, authenticated;
grant select (id, slug, name, type, surface, surfaces, price, description, cover_path, status, created_at, updated_at, characteristics) on public.plans to anon, authenticated;
grant select on public.news, public.videos, public.social_links to anon, authenticated;
grant select on public.public_site_settings to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('plans-private', 'plans-private', false, 52428800, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 52428800, allowed_mime_types = excluded.allowed_mime_types;

create policy "admins manage private plan files"
on storage.objects for all to authenticated
using (bucket_id = 'plans-private' and public.is_admin())
with check (bucket_id = 'plans-private' and public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-media', 'site-media', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = excluded.allowed_mime_types;

create policy "admins manage site media"
on storage.objects for all to authenticated
using (bucket_id = 'site-media' and public.is_admin())
with check (bucket_id = 'site-media' and public.is_admin());

-- The backend must create a short-lived signed URL only after a paid order.
-- Do not add an anon SELECT policy to storage.objects for this bucket.

insert into public.site_stats (id) values (true) on conflict (id) do nothing;
