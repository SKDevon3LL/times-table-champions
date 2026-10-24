-- A child's PIN can only be set, changed or cleared by that child (signed in with their own Google account) or by a
-- grown-up (Sam, 24 Oct 2026: Hughie set a PIN on Jessica's account from his iPad). Any other attempt keeps the old PIN,
-- quietly, so the device's sync carries on instead of failing on every try. The service role is not limited.
create or replace function private.guard_player_pin()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  me text := lower(coalesce(auth.jwt() ->> 'email', ''));
  old_pin text := case when tg_op = 'UPDATE' then old.data ->> 'pinHash' end;
begin
  if new.path not like 'players/%' or me = '' then return new; end if;
  if (new.data ->> 'pinHash') is not distinct from old_pin then return new; end if;
  if exists (select 1 from public.family_members where email = me and role = 'parent') then return new; end if;
  if me = lower(coalesce(new.data ->> 'email', '')) then return new; end if;
  new.data := case when old_pin is null then new.data - 'pinHash' else jsonb_set(new.data, '{pinHash}', to_jsonb(old_pin)) end;
  return new;
end;
$$;
drop trigger if exists guard_player_pin on public.docs;
create trigger guard_player_pin before insert or update on public.docs for each row execute function private.guard_player_pin();
