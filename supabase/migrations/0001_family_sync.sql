-- Applied to Supabase project times-table-champions (wcfpnpgpcxuptxpklksu) on 24 Oct 2026.
-- Who may use the app: the family's Google accounts.
create table public.family_members (
  email text primary key check (email = lower(email)),
  name  text not null,
  role  text not null check (role in ('parent', 'child'))
);
alter table public.family_members enable row level security;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_family()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.family_members
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function private.is_family() from public, anon;
grant execute on function private.is_family() to authenticated;

create policy "family can see the family list" on public.family_members
  for select to authenticated using ((select private.is_family()));

-- Everything the app saves, one JSON document per path
-- (players/<id>, progress/<id>, logs/<id>-<yyyy-mm>, settings/family). No deletes.
create table public.docs (
  path       text primary key check (path ~ '^[a-z]+/[A-Za-z0-9._-]{1,120}$'),
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);
create index docs_updated_at_idx on public.docs (updated_at);
alter table public.docs enable row level security;

create policy "family reads docs" on public.docs
  for select to authenticated using ((select private.is_family()));
create policy "family adds docs" on public.docs
  for insert to authenticated with check ((select private.is_family()));
create policy "family updates docs" on public.docs
  for update to authenticated using ((select private.is_family())) with check ((select private.is_family()));

create or replace function public.docs_stamp()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := lower(coalesce(auth.jwt() ->> 'email', ''));
  return new;
end;
$$;
revoke all on function public.docs_stamp() from public, anon, authenticated;
create trigger docs_stamp before insert or update on public.docs
  for each row execute function public.docs_stamp();

revoke all on public.docs, public.family_members from anon;
grant select, insert, update on public.docs to authenticated;
grant select on public.family_members to authenticated;
