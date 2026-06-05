# Haushalt – private Budget-App

Schlanke Web-App zur Haushaltsführung (Einnahmen & Ausgaben) mit Monatsübersicht,
Vormonats-Vergleich und Saldo-Trend. Läuft als PWA, Daten in Supabase (mit RLS).

## Tech
- Frontend: Vanilla JS, HTML, CSS (kein Build-Schritt), PWA
- Backend: Supabase (Postgres, Auth, Row Level Security)
- Charts: Chart.js
- Hosting: GitHub Pages

## Einrichtung (Supabase)
Im SQL-Editor des Supabase-Projekts nacheinander ausführen:
1. `supabase_setup.sql` – Tabellen, RLS-Policies, Rechte
2. `supabase_fix_grants.sql` – Tabellenrechte nachtragen (falls nötig)
3. `supabase_add_icons.sql` – Icon-Spalte für Kategorien
4. `supabase_add_apps_category.sql` – Standard-Kategorie „Apps"

Anschließend in Supabase unter **Authentication → Email** die
E-Mail-Bestätigung deaktivieren (für reine Eigennutzung).

Die Verbindungsdaten stehen in `js/config.js` (Projekt-URL + **anon**-Key).
Der anon-Key ist öffentlich unbedenklich – RLS stellt sicher, dass jeder
Nutzer ausschließlich seine eigenen Daten sieht.

## Lokal starten
```
python -m http.server 8080
```
Dann http://localhost:8080 öffnen.

## Funktionen
- Buchungen erfassen/bearbeiten/löschen (inkl. Offline-Puffer)
- Kategorien (Farbe, Icon, sortieren, archivieren)
- Wiederkehrende Buchungen (monatlich, automatisch erzeugt)
- Donut-Monatsübersicht mit Kategorie-Aufschlüsselung
- Vormonats-Vergleich (€ und %, pro Kategorie)
- Saldo-Trend der letzten 6 Monate
