-- A child's account can only save its own progress and activity log (Sam, 24 Oct 2026: after Hughie signed in to
-- Jessica's account on his iPad, his play there must not land in her scores). Writes from another child's account are
-- skipped quietly, so that device's sync carries on. Grown-ups and the service role are not limited.
create or replace function private.guard_own_progress()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  me text := lower(coalesce(auth.jwt() ->> 'email', ''));
  pid text;
  owner text;
begin
  if me = '' then return new; end if;
  if new.path like 'progress/%' then pid := substr(new.path, 10);
  elsif new.path like 'logs/%' then pid := regexp_replace(substr(new.path, 6), '-\d{4}-\d{2}$', '');
  else return new; end if;
  if not exists (select 1 from public.family_members where email = me and role = 'child') then return new; end if;
  select lower(coalesce(data ->> 'email', '')) into owner from public.docs where path = 'players/' || pid;
  if owner is null or owner = '' or owner = me then return new; end if;
  return null;
end;
$$;
drop trigger if exists guard_own_progress on public.docs;
create trigger guard_own_progress before insert or update on public.docs for each row execute function private.guard_own_progress();
