# Times Table Champions

Hughie and Jessica's times-table app for their iPads. It installs from Safari to the Home Screen
and works with no internet.

- **Practise** (tricks when stuck), **Test** (Bronze 70%, Silver 80%, Gold 90%, Diamond 100%),
  **Beat the Clock** (60 seconds), **Daily Challenge** (their 15 trickiest facts), **Explore** (dot arrays and patterns).
- **Square times** (1 × 1 to 12 × 12) is a choice of its own in Practise, Test and Beat the Clock. A week's feature exercise
  gets a card on the home page (`FEATURES` in `app.js`, by challenge week): square times in week 2.
- Each child has a theme: Jessica's **Eras** (Taylor Swift fan theme, friendship bracelet), Hughie's
  **Trail** (outdoor adventure, trail map). Grown-ups can change themes in the Grown-ups area.
- Every sign-in, score and answer is recorded; progress charts, a 144-fact map, coaching tips and weekly challenges.

## How it works

| Part | Where |
|---|---|
| The app | `index.html`, `app.js`, fonts and the Supabase library in `vendor/`, no build step |
| Reward games | `games.js`: Hughie's Jungle Gold Run and Jessica's Eras Stadium Show. `shooter.js`: Spell Strike, Hughie's game on the spelling side, a robot shooter where spelling earns ammo, lives and guns; it draws with `vendor/three.min.js` (three.js r128) and loads only when it opens |
| Offline | `sw.js` keeps every file on the device. **Bump `VERSION` in `sw.js` whenever any file changes.** |
| Saving | On the device first (`localStorage`), then copied to Supabase whenever there is internet |
| Sync | Supabase project `times-table-champions` (`wcfpnpgpcxuptxpklksu`, London), table `docs`, one JSON document per path. Two copies of a document merge (`mergeDoc` in `app.js`); nothing is ever deleted |
| Who may use it | Google sign-in once per device, then only the emails in `family_members` can read or write anything (row-level security, `supabase/migrations/0001_family_sync.sql`) |
| Children | Tap their name, type their 4-number PIN (offline) |
| Grown-ups | The Grown-ups area opens without a PIN on a grown-up's own device; on a child's iPad it needs the grown-up PIN |
| Hosting | GitHub Pages from `main` |

The key in `app.js` is Supabase's **publishable** key. It is meant to be public; the row-level security above is what
protects the data.

## Adding or removing a family member

In Supabase, SQL editor:

```sql
insert into public.family_members (email, name, role) values ('someone@gmail.com', 'Name', 'child');
delete from public.family_members where email = 'someone@gmail.com';
```
