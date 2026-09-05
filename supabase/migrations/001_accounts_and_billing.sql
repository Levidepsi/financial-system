-- Run once in the Supabase SQL Editor. Only the server's service role may
-- access these tables/functions; browser JWTs cannot alter billing or quotas.
create table public.monea_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  transactions jsonb not null default '[]'::jsonb check (jsonb_typeof(transactions) = 'array'),
  revision integer not null default 0,
  stripe_customer_id text unique,
  checkout_key uuid,
  checkout_plan text,
  checkout_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.monea_subscriptions (
  subscription_id text primary key,
  user_id uuid not null references public.monea_accounts(user_id) on delete cascade,
  plan text not null check (plan in ('normal', 'premium', 'none')),
  status text not null,
  period_end timestamptz,
  event_created bigint not null,
  event_id text not null
);

alter table public.monea_accounts enable row level security;
alter table public.monea_subscriptions enable row level security;
revoke all on public.monea_accounts, public.monea_subscriptions from public, anon, authenticated;
grant all on public.monea_accounts, public.monea_subscriptions to service_role;

create function public.monea_plan(p_user_id uuid) returns text
language sql stable set search_path = public, pg_temp as $$
  select coalesce((
    select plan from public.monea_subscriptions
    where user_id = p_user_id and status = 'active' and period_end > now()
      and plan in ('normal', 'premium')
    order by (plan = 'premium') desc limit 1
  ), 'none');
$$;

create function public.monea_save_transactions(p_user_id uuid, p_revision integer, p_transactions jsonb)
returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare
  account public.monea_accounts;
  account_plan text;
begin
  select * into account from public.monea_accounts where user_id = p_user_id for update;
  if not found then raise exception 'ACCOUNT_MISSING'; end if;
  if account.revision <> p_revision then raise exception 'REVISION_CONFLICT'; end if;
  if jsonb_typeof(p_transactions) <> 'array' then raise exception 'INVALID_TRANSACTIONS'; end if;
  account_plan := public.monea_plan(p_user_id);

  -- Expired/unsubscribed users can still read, export, delete, and mark loans
  -- paid. Adding or changing financial entries requires an active plan.
  if account_plan = 'none' and exists (
    select 1 from jsonb_array_elements(p_transactions) n
    where not exists (
      select 1 from jsonb_array_elements(account.transactions) o
      where o->>'id' = n->>'id' and (o - 'paid') = (n - 'paid')
    )
  ) then raise exception 'SUBSCRIPTION_REQUIRED'; end if;

  if account_plan = 'normal' and exists (
    select 1 from (
      select n->>'type' as kind, left(n->>'date', 7) as month, count(*) as total
      from jsonb_array_elements(p_transactions) n
      where n->>'type' in ('income', 'expense')
      group by n->>'type', left(n->>'date', 7)
    ) proposed
    where proposed.total > 5 and proposed.total > (
      select count(*) from jsonb_array_elements(account.transactions) o
      where o->>'type' = proposed.kind and left(o->>'date', 7) = proposed.month
    )
  ) then raise exception 'PLAN_LIMIT'; end if;

  update public.monea_accounts set transactions = p_transactions,
    revision = revision + 1, updated_at = now() where user_id = p_user_id;
  return jsonb_build_object('revision', account.revision + 1, 'transactions', p_transactions, 'plan', account_plan);
end;
$$;

create function public.monea_reserve_checkout(p_user_id uuid, p_plan text)
returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare account public.monea_accounts;
begin
  if p_plan not in ('normal', 'premium') then raise exception 'INVALID_PLAN'; end if;
  select * into account from public.monea_accounts where user_id = p_user_id for update;
  if not found then raise exception 'ACCOUNT_MISSING'; end if;
  if account.checkout_expires_at > now() then
    if account.checkout_plan <> p_plan then raise exception 'CHECKOUT_PENDING'; end if;
  else
    update public.monea_accounts set checkout_key = gen_random_uuid(), checkout_plan = p_plan,
      checkout_expires_at = date_trunc('second', now()) + interval '1 hour'
      where user_id = p_user_id returning * into account;
  end if;
  return jsonb_build_object('key', account.checkout_key, 'expires_at', extract(epoch from account.checkout_expires_at)::bigint);
end;
$$;

create function public.monea_apply_subscription(
  p_subscription_id text, p_customer_id text, p_plan text, p_status text,
  p_period_end timestamptz, p_event_created bigint, p_event_id text
) returns void language plpgsql set search_path = public, pg_temp as $$
declare account_user uuid;
begin
  select user_id into account_user from public.monea_accounts
    where stripe_customer_id = p_customer_id for update;
  -- An unrelated Stripe product/customer does not belong to this app.
  if account_user is null then return; end if;
  insert into public.monea_subscriptions(subscription_id, user_id, plan, status, period_end, event_created, event_id)
    values(p_subscription_id, account_user, p_plan, p_status, p_period_end, p_event_created, p_event_id)
  on conflict (subscription_id) do update set plan = excluded.plan, status = excluded.status,
    period_end = excluded.period_end, event_created = excluded.event_created, event_id = excluded.event_id
  where public.monea_subscriptions.event_created <= excluded.event_created
    and public.monea_subscriptions.event_id <> excluded.event_id;
end;
$$;

revoke all on function public.monea_plan(uuid) from public, anon, authenticated;
revoke all on function public.monea_save_transactions(uuid, integer, jsonb) from public, anon, authenticated;
revoke all on function public.monea_reserve_checkout(uuid, text) from public, anon, authenticated;
revoke all on function public.monea_apply_subscription(text, text, text, text, timestamptz, bigint, text) from public, anon, authenticated;
grant execute on function public.monea_plan(uuid) to service_role;
grant execute on function public.monea_save_transactions(uuid, integer, jsonb) to service_role;
grant execute on function public.monea_reserve_checkout(uuid, text) to service_role;
grant execute on function public.monea_apply_subscription(text, text, text, text, timestamptz, bigint, text) to service_role;
