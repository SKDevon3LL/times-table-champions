-- The weekly report (Sam, 24 Oct 2026): every Sunday evening a scheduled call runs the weekly-report Edge Function,
-- which reads the week, asks Claude for next week's plan and the email, writes plans/<id> and emails the grown-ups.
-- The call carries a key that lives only in this database's vault; the function checks it through
-- public.weekly_report_key_ok, which only the service role may run.
create extension if not exists pg_net;
create extension if not exists pg_cron;

select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'weekly_report_key', 'Key the Sunday cron sends to the weekly-report function')
where not exists (select 1 from vault.secrets where name = 'weekly_report_key');

create or replace function public.weekly_report_key_ok(p_key text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'weekly_report_key' and decrypted_secret = p_key);
$$;
revoke all on function public.weekly_report_key_ok(text) from public, anon, authenticated;
grant execute on function public.weekly_report_key_ok(text) to service_role;
