-- Le bac à sable attribue Pro via le même abonnement que le reste de Renzvi.
create table public.whop_test_checkouts (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade
);
alter table public.whop_test_checkouts enable row level security;
revoke all on public.whop_test_checkouts from public, anon, authenticated;
grant insert on public.whop_test_checkouts to service_role;

create table renzvi_internal.whop_test_memberships (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  statut text not null check (statut in ('actif', 'annule', 'expire')),
  fin timestamptz,
  whop_updated_at timestamptz not null,
  check (statut = 'expire' or fin is not null)
);
create index whop_test_memberships_user_idx on renzvi_internal.whop_test_memberships(user_id);
alter table renzvi_internal.whop_test_memberships enable row level security;
grant select, insert, update on renzvi_internal.whop_test_memberships to service_role;

create table renzvi_internal.whop_test_events (id text primary key);
alter table renzvi_internal.whop_test_events enable row level security;
grant select, insert on renzvi_internal.whop_test_events to service_role;
grant select on public.whop_test_checkouts to service_role;
grant select, insert, update on public.abonnements to service_role;

create function public.whop_test_apply(
  p_event text, p_membership text, p_checkout text,
  p_statut text, p_fin timestamptz, p_updated timestamptz
) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid;
  payer_id uuid;
  access_row renzvi_internal.whop_test_memberships%rowtype;
begin
  insert into renzvi_internal.whop_test_events(id) values (p_event) on conflict do nothing;
  if not found then return; end if;

  -- Le paiement et les changements de statut peuvent arriver dans n'importe quel ordre.
  perform pg_advisory_xact_lock(hashtext('whop_test_membership'), hashtext(p_membership));
  select m.user_id into owner_id from renzvi_internal.whop_test_memberships m where m.id = p_membership;
  if p_checkout is not null then
    select c.user_id into payer_id from public.whop_test_checkouts c where c.id = p_checkout;
    if payer_id is null or (owner_id is not null and owner_id <> payer_id) then return; end if;
  end if;
  owner_id := coalesce(owner_id, payer_id);

  if owner_id is not null then
    perform pg_advisory_xact_lock(hashtext('whop_test_user'), hashtext(owner_id::text));
  end if;
  insert into renzvi_internal.whop_test_memberships as m (id, user_id, statut, fin, whop_updated_at)
  values (p_membership, owner_id, p_statut, p_fin, p_updated)
  on conflict (id) do update set
    user_id = coalesce(m.user_id, excluded.user_id),
    statut = case when excluded.whop_updated_at > m.whop_updated_at then excluded.statut else m.statut end,
    fin = case when excluded.whop_updated_at > m.whop_updated_at then excluded.fin else m.fin end,
    whop_updated_at = greatest(excluded.whop_updated_at, m.whop_updated_at)
  where excluded.whop_updated_at > m.whop_updated_at or (m.user_id is null and excluded.user_id is not null);

  if owner_id is null or not found then return; end if;
  select m.* into access_row from renzvi_internal.whop_test_memberships m
    where m.user_id = owner_id and m.statut in ('actif', 'annule') and m.fin > now()
    order by m.fin desc, m.id limit 1;
  if found then
    insert into public.abonnements as a (user_id, plan, statut, fin, source, whop_membership_id)
    values (owner_id, 'pro', access_row.statut, access_row.fin, 'whop', access_row.id)
    on conflict (user_id) do update set statut = excluded.statut, fin = excluded.fin,
      plan = excluded.plan, source = excluded.source, whop_membership_id = excluded.whop_membership_id, updated_at = now()
    where (
      (a.source = 'whop' and exists (select 1 from renzvi_internal.whop_test_memberships m where m.id = a.whop_membership_id))
      or a.statut = 'expire' or a.fin <= now()
    ) and (a.plan, a.statut, a.fin, a.source, a.whop_membership_id)
      is distinct from (excluded.plan, excluded.statut, excluded.fin, excluded.source, excluded.whop_membership_id);
  else
    update public.abonnements a set statut = 'expire', fin = least(a.fin, now()), updated_at = now()
      where a.user_id = owner_id and a.source = 'whop' and a.statut <> 'expire'
        and exists (select 1 from renzvi_internal.whop_test_memberships m where m.id = a.whop_membership_id);
  end if;
end
$$;

revoke all on function public.whop_test_apply(text, text, text, text, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.whop_test_apply(text, text, text, text, timestamptz, timestamptz)
  to service_role;
