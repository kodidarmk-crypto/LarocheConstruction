begin;

alter table public.site_stats
  add column if not exists project_requests bigint not null default 0 check (project_requests >= 0);

revoke select on public.site_stats from anon, authenticated;
revoke select (project_requests) on public.site_stats from anon, authenticated;
grant select (projects, experience, collaborators, cities, clients)
  on public.site_stats to anon, authenticated;

alter table public.newsletter_subscribers
  add column if not exists consented_at timestamptz,
  add column if not exists consent_source text,
  add column if not exists consent_version text;

update public.newsletter_subscribers
set status = 'unsubscribed',
    updated_at = now()
where status = 'active'
  and (consented_at is null or consent_source is null or consent_version is null);

alter table public.newsletter_subscribers
  drop constraint if exists newsletter_active_requires_consent;
alter table public.newsletter_subscribers
  add constraint newsletter_active_requires_consent
  check (
    status <> 'active'
    or (consented_at is not null and consent_source is not null and consent_version is not null)
  );

drop policy if exists "public newsletter signup" on public.newsletter_subscribers;
revoke insert on public.newsletter_subscribers from anon, authenticated;

drop policy if exists "public submit project lead" on public.project_leads;
revoke insert on public.project_leads from anon, authenticated;

create table if not exists public.project_request_receipts (
  request_hash text primary key check (request_hash ~ '^[a-f0-9]{64}$'),
  status text not null check (status in ('processing', 'sent', 'failed')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists project_request_receipts_expiry_idx
  on public.project_request_receipts (expires_at);

alter table public.project_request_receipts enable row level security;
revoke all on public.project_request_receipts from anon, authenticated;

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
begin
  update public.project_request_receipts
  set status = case when p_sent then 'sent' else 'failed' end
  where request_hash = p_request_hash
    and status = 'processing'
  returning status into v_status;

  if not found then
    select status into v_status
    from public.project_request_receipts
    where request_hash = p_request_hash;
    return jsonb_build_object('finalized', false, 'status', v_status);
  end if;

  if p_sent then
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

revoke all on function public.claim_project_request(text) from public, anon, authenticated;
revoke all on function public.complete_project_request(text, boolean) from public, anon, authenticated;
revoke all on function public.apply_monetbil_payment(uuid, uuid, text, text, bigint, text, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_project_request(text) to service_role;
grant execute on function public.complete_project_request(text, boolean) to service_role;
grant execute on function public.apply_monetbil_payment(uuid, uuid, text, text, bigint, text, text, text)
  to service_role;

insert into public.site_stats (id) values (true) on conflict (id) do nothing;

commit;
