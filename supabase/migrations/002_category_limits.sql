begin;

create table public.monea_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.monea_accounts(user_id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  name text not null check (length(name) between 1 and 40 and name = btrim(name)),
  created_at timestamptz not null default now()
);
create unique index monea_categories_name on public.monea_categories(user_id, type, lower(name));
alter table public.monea_categories enable row level security;
revoke all on public.monea_categories from public, anon, authenticated;
grant all on public.monea_categories to service_role;

-- Preserve every category used by existing ledgers, even above new limits.
insert into public.monea_categories(user_id, type, name)
select distinct on (a.user_id, t->>'type', lower(t->>'category'))
  a.user_id, t->>'type', t->>'category'
from public.monea_accounts a cross join lateral jsonb_array_elements(a.transactions) t
where t->>'type' in ('income', 'expense')
order by a.user_id, t->>'type', lower(t->>'category');

create function public.monea_categories_for(p_user_id uuid) returns jsonb
language sql stable set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'type', type, 'name', name) order by created_at, name), '[]')
  from public.monea_categories where user_id = p_user_id;
$$;

create function public.monea_ensure_category(p_user_id uuid, p_type text, p_name text)
returns void language plpgsql set search_path = public, pg_temp as $$
declare category_name text; account_plan text; category_count integer; category_limit integer;
begin
  -- Serialize every category-creation path, including concurrent imports.
  perform 1 from public.monea_accounts where user_id = p_user_id for update;
  if not found then raise exception 'ACCOUNT_MISSING'; end if;
  if p_type is null or p_type not in ('income', 'expense') or p_name is null
    or p_name ~ '[[:cntrl:]]' then raise exception 'INVALID_CATEGORY'; end if;
  category_name := btrim(regexp_replace(p_name, '\s+', ' ', 'g'));
  if length(category_name) not between 1 and 40 or lower(category_name) in ('all', '__custom__', 'savings')
    or (p_type = 'expense' and lower(category_name) = 'income') then raise exception 'INVALID_CATEGORY'; end if;
  if exists(select 1 from public.monea_categories where user_id = p_user_id and type = p_type
    and lower(name) = lower(category_name)) then return; end if;
  account_plan := public.monea_plan(p_user_id);
  category_limit := case when p_type = 'income' then 2 else 5 end;
  select count(*) into category_count from public.monea_categories where user_id = p_user_id and type = p_type;
  if account_plan <> 'premium' and category_count >= category_limit then
    raise exception '%_%_CATEGORY_LIMIT', case when account_plan = 'normal' then 'NORMAL' else 'FREE' end, upper(p_type);
  end if;
  insert into public.monea_categories(user_id, type, name) values(p_user_id, p_type, category_name);
end;
$$;

create function public.monea_create_category(p_user_id uuid, p_revision integer, p_type text, p_name text)
returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare account public.monea_accounts;
begin
  select * into account from public.monea_accounts where user_id = p_user_id for update;
  if not found then raise exception 'ACCOUNT_MISSING'; end if;
  if p_revision is null or p_revision <> account.revision then raise exception 'REVISION_CONFLICT'; end if;
  perform public.monea_ensure_category(p_user_id, p_type, p_name);
  update public.monea_accounts set revision = revision + 1, updated_at = now() where user_id = p_user_id;
  return jsonb_build_object('revision', account.revision + 1, 'categories', public.monea_categories_for(p_user_id),
    'plan', public.monea_plan(p_user_id));
end;
$$;

create or replace function public.monea_save_transactions(p_user_id uuid, p_revision integer, p_transactions jsonb)
returns jsonb language plpgsql set search_path = public, pg_temp as $$
declare account public.monea_accounts; category record; canonical_transactions jsonb;
begin
  select * into account from public.monea_accounts where user_id = p_user_id for update;
  if not found then raise exception 'ACCOUNT_MISSING'; end if;
  if p_revision is null or p_revision <> account.revision then raise exception 'REVISION_CONFLICT'; end if;
  if p_transactions is null or jsonb_typeof(p_transactions) <> 'array' then raise exception 'INVALID_TRANSACTIONS'; end if;
  for category in select distinct t->>'type' as type, t->>'category' as name
    from jsonb_array_elements(p_transactions) t where t->>'type' in ('income', 'expense')
  loop
    perform public.monea_ensure_category(p_user_id, category.type, category.name);
  end loop;
  -- Use the stored spelling, so case variants do not create separate reports.
  select coalesce(jsonb_agg(case when c.id is null then t.value else
    jsonb_set(t.value, '{category}', to_jsonb(c.name)) end order by t.ordinality), '[]')
    into canonical_transactions from jsonb_array_elements(p_transactions) with ordinality t
    left join public.monea_categories c on c.user_id = p_user_id and c.type = t.value->>'type'
      and lower(c.name) = lower(t.value->>'category');
  update public.monea_accounts set transactions = canonical_transactions, revision = revision + 1,
    updated_at = now() where user_id = p_user_id;
  return jsonb_build_object('revision', account.revision + 1, 'transactions', canonical_transactions,
    'categories', public.monea_categories_for(p_user_id), 'plan', public.monea_plan(p_user_id));
end;
$$;

alter table public.monea_subscriptions add column cancel_at_period_end boolean not null default false,
  add column billing_amount integer, add column billing_currency text, add column billing_interval text;

-- Replace the old webhook RPC so billing details update atomically with access.
drop function public.monea_apply_subscription(text, text, text, text, timestamptz, bigint, text);
create function public.monea_apply_subscription(
  p_subscription_id text, p_customer_id text, p_plan text, p_status text,
  p_period_end timestamptz, p_event_created bigint, p_event_id text,
  p_cancel_at_period_end boolean default false, p_billing_amount integer default null,
  p_billing_currency text default null, p_billing_interval text default null
) returns void language plpgsql set search_path = public, pg_temp as $$
declare account_user uuid;
begin
  select user_id into account_user from public.monea_accounts where stripe_customer_id = p_customer_id for update;
  if account_user is null then return; end if;
  insert into public.monea_subscriptions(subscription_id, user_id, plan, status, period_end, event_created, event_id,
    cancel_at_period_end, billing_amount, billing_currency, billing_interval)
  values(p_subscription_id, account_user, p_plan, p_status, p_period_end, p_event_created, p_event_id,
    p_cancel_at_period_end, p_billing_amount, p_billing_currency, p_billing_interval)
  on conflict (subscription_id) do update set plan = excluded.plan, status = excluded.status,
    period_end = excluded.period_end, event_created = excluded.event_created, event_id = excluded.event_id,
    cancel_at_period_end = excluded.cancel_at_period_end, billing_amount = excluded.billing_amount,
    billing_currency = excluded.billing_currency, billing_interval = excluded.billing_interval
  where public.monea_subscriptions.event_created <= excluded.event_created
    and public.monea_subscriptions.event_id <> excluded.event_id;
end;
$$;

create function public.monea_account_details(p_user_id uuid) returns jsonb
language sql stable set search_path = public, pg_temp as $$
  select jsonb_build_object('plan', public.monea_plan(p_user_id),
    'categories', public.monea_categories_for(p_user_id), 'subscription', (
      select jsonb_build_object('plan', plan, 'status', status, 'periodEnd', period_end,
        'cancelAtPeriodEnd', cancel_at_period_end, 'amount', billing_amount,
        'currency', billing_currency, 'interval', billing_interval)
      from public.monea_subscriptions where user_id = p_user_id
      order by (status = 'active' and period_end > now()) desc, (plan = 'premium') desc, event_created desc limit 1
    ));
$$;

revoke all on function public.monea_categories_for(uuid), public.monea_ensure_category(uuid, text, text),
  public.monea_create_category(uuid, integer, text, text), public.monea_account_details(uuid),
  public.monea_apply_subscription(text, text, text, text, timestamptz, bigint, text, boolean, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.monea_categories_for(uuid), public.monea_ensure_category(uuid, text, text),
  public.monea_create_category(uuid, integer, text, text), public.monea_account_details(uuid),
  public.monea_apply_subscription(text, text, text, text, timestamptz, bigint, text, boolean, integer, text, text)
  to service_role;
commit;
