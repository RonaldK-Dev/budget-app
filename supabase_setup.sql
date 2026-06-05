-- ============================================================
-- Budget App – Supabase Schema Setup
-- Dieses Script einmalig im Supabase SQL Editor ausführen
-- ============================================================

-- Kategorien
create table public.categories (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  name        text        not null,
  typ         text        not null check (typ in ('einnahme', 'ausgabe')),
  color       text        not null default '#888888',
  sort_order  int         not null default 0,
  archiviert  boolean     not null default false,
  created_at  timestamptz not null default now()
);

alter table public.categories enable row level security;

create policy "Eigene Kategorien" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Wiederkehrende Vorlagen (vor transactions wegen FK)
create table public.recurring (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  name          text        not null,
  betrag        numeric(12,2) not null check (betrag > 0),
  typ           text        not null check (typ in ('einnahme', 'ausgabe')),
  category_id   uuid        references public.categories(id) on delete set null,
  tag_im_monat  int         not null check (tag_im_monat between 1 and 28),
  aktiv         boolean     not null default true,
  letzter_lauf  date,
  created_at    timestamptz not null default now()
);

alter table public.recurring enable row level security;

create policy "Eigene Vorlagen" on public.recurring
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Buchungen
create table public.transactions (
  id           uuid          primary key default gen_random_uuid(),
  user_id      uuid          not null references auth.users(id) on delete cascade,
  datum        date          not null,
  betrag       numeric(12,2) not null check (betrag > 0),
  typ          text          not null check (typ in ('einnahme', 'ausgabe')),
  category_id  uuid          references public.categories(id) on delete set null,
  notiz        text,
  recurring_id uuid          references public.recurring(id) on delete set null,
  created_at   timestamptz   not null default now(),
  updated_at   timestamptz   not null default now()
);

alter table public.transactions enable row level security;

create policy "Eigene Buchungen" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Auto-Update für updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_transactions_updated_at
  before update on public.transactions
  for each row execute function public.touch_updated_at();

-- ============================================================
-- Rechte für die PostgREST-Rollen (RLS schützt die Zeilen)
-- ============================================================
grant usage on schema public to anon, authenticated;
grant all on public.categories   to anon, authenticated;
grant all on public.transactions to anon, authenticated;
grant all on public.recurring    to anon, authenticated;

alter default privileges in schema public
  grant all on tables to anon, authenticated;
