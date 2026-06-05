-- ============================================================
-- Icons für Kategorien (für Icon-Kacheln in der Erfassung)
-- Einmalig im Supabase SQL Editor ausführen. Nicht-destruktiv.
-- ============================================================

alter table public.categories
  add column if not exists icon text not null default '🏷️';

-- Sinnvolle Standard-Symbole für die Default-Kategorien setzen
update public.categories set icon = '🏠' where name = 'Miete / Wohnen';
update public.categories set icon = '🛒' where name = 'Lebensmittel';
update public.categories set icon = '🚗' where name = 'Auto / Transport';
update public.categories set icon = '🛡️' where name = 'Versicherungen';
update public.categories set icon = '🎉' where name = 'Freizeit';
update public.categories set icon = '💊' where name = 'Gesundheit';
update public.categories set icon = '💰' where name = 'Gehalt';
update public.categories set icon = '📦' where name = 'Sonstiges' and typ = 'ausgabe';
update public.categories set icon = '💸' where name = 'Sonstiges' and typ = 'einnahme';
