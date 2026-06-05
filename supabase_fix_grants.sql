-- ============================================================
-- FIX: Fehlende Tabellen-Rechte für PostgREST-Rollen nachtragen
-- Einmalig im Supabase SQL Editor ausführen. Nicht-destruktiv.
-- (RLS schützt weiterhin: jeder sieht nur seine eigenen Zeilen.)
-- ============================================================

grant usage on schema public to anon, authenticated;

grant all on public.categories   to anon, authenticated;
grant all on public.transactions to anon, authenticated;
grant all on public.recurring    to anon, authenticated;

-- Falls künftig weitere Tabellen dazukommen, automatisch berechtigen:
alter default privileges in schema public
  grant all on tables to anon, authenticated;
