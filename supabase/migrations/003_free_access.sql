-- Apply after 001 and 002. Keeps sign-in, ownership, validation, revision
-- checks, categories, transactions and historical billing records intact.
begin;

create or replace function public.monea_plan(p_user_id uuid) returns text
language sql stable set search_path = public, pg_temp as $$
  select 'free'::text;
$$;

create or replace function public.monea_ensure_category(p_user_id uuid, p_type text, p_name text)
returns void language plpgsql set search_path = public, pg_temp as $$
declare category_name text;
begin
  perform 1 from public.monea_accounts where user_id = p_user_id for update;
  if not found then raise exception 'ACCOUNT_MISSING'; end if;
  if p_type is null or p_type not in ('income', 'expense') or p_name is null
    or p_name ~ '[[:cntrl:]]' then raise exception 'INVALID_CATEGORY'; end if;
  category_name := btrim(regexp_replace(p_name, '\s+', ' ', 'g'));
  if length(category_name) not between 1 and 40 or lower(category_name) in ('all', '__custom__', 'savings')
    or (p_type = 'expense' and lower(category_name) = 'income') then raise exception 'INVALID_CATEGORY'; end if;
  if exists(select 1 from public.monea_categories where user_id = p_user_id and type = p_type
    and lower(name) = lower(category_name)) then return; end if;
  insert into public.monea_categories(user_id, type, name) values(p_user_id, p_type, category_name);
end;
$$;

create or replace function public.monea_account_details(p_user_id uuid) returns jsonb
language sql stable set search_path = public, pg_temp as $$
  select jsonb_build_object('plan', 'free', 'categories', public.monea_categories_for(p_user_id));
$$;

-- Reassert that browsers cannot call privileged database functions directly.
revoke all on function public.monea_plan(uuid), public.monea_ensure_category(uuid, text, text),
  public.monea_account_details(uuid) from public, anon, authenticated;
grant execute on function public.monea_plan(uuid), public.monea_ensure_category(uuid, text, text),
  public.monea_account_details(uuid) to service_role;

commit;
