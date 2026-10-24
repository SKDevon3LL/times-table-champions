-- Private pictures for the reward games (24 Oct 2026): Jessica's stage photos and Hughie's jungle pictures.
-- Real children's faces, so never in the public repo: a private bucket only the family's accounts can read or add to.
insert into storage.buckets (id, name, public) values ('family-photos', 'family-photos', false)
on conflict (id) do nothing;

create policy "family reads family photos" on storage.objects
  for select to authenticated using (bucket_id = 'family-photos' and (select private.is_family()));
create policy "family adds family photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'family-photos' and (select private.is_family()));
create policy "family replaces family photos" on storage.objects
  for update to authenticated using (bucket_id = 'family-photos' and (select private.is_family())) with check (bucket_id = 'family-photos' and (select private.is_family()));
