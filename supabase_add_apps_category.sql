-- ============================================================
-- Feste Kategorie "Apps" (📱) für alle bestehenden Nutzer.
-- Einmalig im Supabase SQL Editor ausführen. Idempotent.
-- ============================================================

insert into public.categories (user_id, name, typ, color, icon, sort_order)
select u.id, 'Apps', 'ausgabe', '#EC407A', '📱', 7
from auth.users u
where not exists (
  select 1 from public.categories c
  where c.user_id = u.id and c.name = 'Apps' and c.typ = 'ausgabe'
);
