-- Additive migration. Do not enable PERFI_ACCESS_ENABLED until verification succeeds.
begin;
create table if not exists public.perfi_access_config (
  singleton boolean primary key default true check (singleton),
  complimentary_cutoff timestamptz not null,
  verified_at timestamptz
);
-- The cutoff is captured ONCE, before the new registration flow is enabled.
insert into public.perfi_access_config(singleton, complimentary_cutoff)
values (true, transaction_timestamp()) on conflict do nothing;

create table if not exists public.perfi_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_type text not null default 'lifetime' check (access_type = 'lifetime'),
  source text not null check (source in ('complimentary_existing_user', 'activation')),
  activated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
insert into public.perfi_entitlements(user_id, source)
select id, 'complimentary_existing_user' from auth.users
where created_at <= (select complimentary_cutoff from public.perfi_access_config)
on conflict (user_id) do nothing;

create table if not exists public.perfi_activation_sessions (
  id uuid primary key default gen_random_uuid(),
  session_hash text not null unique check (session_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  consumed_at timestamptz,
  activated_user_id uuid unique references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.perfi_login_activity (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_activity_at timestamptz not null,
  revoked_at timestamptz
);
create table if not exists public.perfi_web_sessions (
  session_hash text primary key check (session_hash ~ '^[a-f0-9]{64}$'),
  session_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists perfi_web_sessions_session on public.perfi_web_sessions(session_id);
create table if not exists public.perfi_access_rate_limits (
  bucket text primary key,
  window_start timestamptz not null,
  attempts integer not null
);
alter table public.perfi_access_rate_limits enable row level security;
revoke all on public.perfi_access_rate_limits from public, anon, authenticated;
grant all on public.perfi_access_rate_limits to service_role;
create or replace function public.perfi_rate_limit(p_bucket text, p_limit integer, p_seconds integer)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare used integer;
begin
  insert into perfi_access_rate_limits(bucket, window_start, attempts) values(p_bucket, now(), 1)
  on conflict(bucket) do update set
    window_start = case when perfi_access_rate_limits.window_start <= now() - make_interval(secs => p_seconds) then now() else perfi_access_rate_limits.window_start end,
    attempts = case when perfi_access_rate_limits.window_start <= now() - make_interval(secs => p_seconds) then 1 else perfi_access_rate_limits.attempts + 1 end
  returning attempts into used;
  return used <= p_limit;
end;
$$;
revoke all on function public.perfi_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.perfi_rate_limit(text, integer, integer) to service_role;

alter table public.perfi_access_config enable row level security;
alter table public.perfi_entitlements enable row level security;
alter table public.perfi_activation_sessions enable row level security;
alter table public.perfi_login_activity enable row level security;
alter table public.perfi_web_sessions enable row level security;
revoke all on public.perfi_access_config, public.perfi_entitlements, public.perfi_activation_sessions,
  public.perfi_login_activity, public.perfi_web_sessions from public, anon, authenticated;
grant all on public.perfi_access_config, public.perfi_entitlements, public.perfi_activation_sessions,
  public.perfi_login_activity, public.perfi_web_sessions to service_role;

-- Called explicitly after reviewing the migration and preserved financial data.
create or replace function public.perfi_verify_migration() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare missing integer; total integer;
begin
  select count(*) into total from auth.users
    where created_at <= (select complimentary_cutoff from perfi_access_config);
  select count(*) into missing from auth.users u
    where u.created_at <= (select complimentary_cutoff from perfi_access_config)
      and not exists(select 1 from perfi_entitlements e where e.user_id = u.id);
  if missing <> 0 then raise exception 'COMPLIMENTARY_USERS_MISSING'; end if;
  update perfi_access_config set verified_at = now();
  return jsonb_build_object('existing_users', total, 'missing', missing);
end;
$$;

-- Trigger runs inside the SAME transaction as the Supabase Auth user insertion.
-- app_metadata is admin-only; user_metadata is deliberately never trusted.
create or replace function public.perfi_activate_new_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare activation_hash text; activation public.perfi_activation_sessions;
begin
  activation_hash := new.raw_app_meta_data->>'perfi_activation_hash';
  if activation_hash is null then return new; end if;
  if not exists(select 1 from perfi_access_config where verified_at is not null) then
    raise exception 'ACTIVATION_NOT_READY';
  end if;
  select * into activation from perfi_activation_sessions where session_hash = activation_hash for update;
  if not found then raise exception 'ACTIVATION_MISSING'; end if;
  if activation.consumed_at is not null then raise exception 'ACTIVATION_USED'; end if;
  if activation.expires_at <= now() then raise exception 'ACTIVATION_EXPIRED'; end if;
  insert into perfi_entitlements(user_id, source) values (new.id, 'activation');
  update perfi_activation_sessions set consumed_at = now(), activated_user_id = new.id
    where id = activation.id;
  return new;
end;
$$;
drop trigger if exists perfi_activate_new_user on auth.users;
create trigger perfi_activate_new_user after insert on auth.users
for each row execute function public.perfi_activate_new_user();

-- A verified JWT's session_id (or its server-issued web-session mapping) is required.
-- Polling uses p_touch=false; human activity and writes may touch at most every 5 minutes.
create or replace function public.perfi_authorize(p_user_id uuid, p_session_id uuid, p_touch boolean default false)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare started timestamptz; activity public.perfi_login_activity; entitlement public.perfi_entitlements;
begin
  if not exists(select 1 from perfi_access_config where verified_at is not null) then
    return jsonb_build_object('status', 'not_ready');
  end if;
  select created_at into started from auth.sessions where id = p_session_id and user_id = p_user_id;
  if not found then return jsonb_build_object('status', 'expired'); end if;
  insert into perfi_login_activity(session_id, user_id, last_activity_at)
    values (p_session_id, p_user_id, started) on conflict do nothing;
  select * into activity from perfi_login_activity where session_id = p_session_id for update;
  if activity.user_id <> p_user_id or activity.revoked_at is not null
    or activity.last_activity_at <= now() - interval '7 days' then
    return jsonb_build_object('status', 'expired');
  end if;
  select * into entitlement from perfi_entitlements where user_id = p_user_id;
  if not found then return jsonb_build_object('status', 'access_required'); end if;
  if p_touch and activity.last_activity_at < now() - interval '5 minutes' then
    update perfi_login_activity set last_activity_at = now() where session_id = p_session_id;
  end if;
  return jsonb_build_object('status', 'active', 'source', entitlement.source, 'access_type', entitlement.access_type);
end;
$$;
revoke all on function public.perfi_verify_migration(), public.perfi_activate_new_user(),
  public.perfi_authorize(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.perfi_verify_migration(), public.perfi_authorize(uuid, uuid, boolean) to service_role;
commit;
