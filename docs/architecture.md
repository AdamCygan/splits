# Architektura — decyzje

Krótkie zapisy decyzji (ADR-lite): co wybraliśmy i dlaczego.

## 1. Jedna aplikacja w TypeScripcie (strony + API)

Strony (TanStack Start, SSR) i API (`/api/v1`) działają w jednym procesie Node i wdrażają się
jako jeden obraz. Jeden język, jeden zestaw typów i jedno wdrożenie zamiast dwóch aplikacji.

- `src/routes/api/v1/$.ts` przekazuje każde żądanie `/api/v1/*` do aplikacji **Hono** (`src/server/app.ts`).
  Import jest dynamiczny, więc kod serwera (baza, hasła, tokeny) nie trafia do bundla przeglądarki.
- Trasy API leżą w `src/server/features/*` (auth, account, config, sprints, entries). Handler sam
  rozmawia z bazą przez Drizzle; dodatkowa warstwa repozytoriów tylko by to dublowała.
- Reguły biznesowe są w `src/domain/*` i **te same funkcje** sprawdzają formularz w przeglądarce
  i dane na serwerze (np. `validateEntry`, `validateScale`, `missingCadenceSprints`).
- Wcześniejszy szkielet backendu w .NET został usunięty: nie miał jeszcze logiki, a blokował pracę.

Mikroserwisy nie mają tu sensu: jeden zespół, jedna baza, mały ruch.

## 2. Obsługa błędów: kody + Problem Details

- Błąd domenowy to `ApiError(code, status, field?)` ze stabilnym kodem (słownik `src/i18n/messages/errors.ts`).
- Każda odpowiedź błędu ma jeden format — **Problem Details (RFC 9457)** z polami `code`, `errors`, `traceId`,
  a komunikat jest w języku użytkownika (ciasteczko `app_locale` albo `Accept-Language`).
- Naruszenia ograniczeń w Postgresie (unikalność, CHECK) zamieniamy na te same kody, więc wyścig dwóch
  żądań kończy się czytelnym błędem, a nie 500.
- Frontend parsuje ten format w `lib/api-client.ts` i zwraca `Result<ApiFailure, T>`.

## 3. Baza: Postgres + Drizzle, model per użytkownik

- Schemat w `src/server/db/schema.ts`, migracje SQL w `drizzle/` (`pnpm db:generate`).
- Migracje wykonują się przy starcie serwera pod blokadą doradczą (`pg_advisory_lock`), więc kilka maszyn
  naraz nic nie psuje. Na Neonie migracje mogą iść adresem bez poolera (`DATABASE_URL_UNPOOLED`).
- Każdy rekord ma `user_id`; każde zapytanie filtruje po zalogowanym użytkowniku, a id typu czy projektu
  z innego konta traktujemy jak nieistniejące (test „keeps every account’s data private”).
- Indeksy częściowe pilnują reguł: jeden działający timer, jeden status domyślny, unikalne skróty szablonów.
- Prisma odpadła, bo przy każdym `generate`/`migrate` pobiera natywny silnik spoza npm; Drizzle to czysty TypeScript.

## 4. Strony: TanStack Start

- **SSR** dla części publicznej (landing, cennik, dokumenty prawne): SEO i szybki pierwszy ekran.
- Panel `/app` renderuje się tylko w przeglądarce (`ssr: false`): sesja żyje w pamięci i ciasteczku httpOnly.
- **TanStack Query** do danych z serwera, **Zod** waliduje formularze i odpowiedzi API.

### Komponenty: MVVM

Większe ekrany panelu są w układzie **Model – ViewModel – View**, żeby logika nie mieszała się
z JSX i żeby te same reguły nie powtarzały się na kilku stronach.

- **Model** — czyste funkcje bez Reacta, z testami w `tests/unit`. Reguły wspólne dla wielu
  ekranów (i dla API) są w `src/domain/*` (np. `task-groups`, `task-list`, `workday`,
  `templates`, `sprints`, `report`, `day-summary`, `task-insights`, `numbers`, `archive`).
  Reguły jednego formularza mogą leżeć obok niego w `model.ts` (np. `entry-form/model.ts`).
- **ViewModel** — hook `useXViewModel(props)` w `use-x.ts`: zapytania (TanStack Query),
  stan ekranu, mutacje, wartości pochodne i akcje. Zwraca jeden obiekt, a jego typ
  eksportujemy jako `XViewModel = ReturnType<typeof useXViewModel>`.
- **View** — komponenty, które dostają `vm` i tylko renderują albo wywołują akcje
  (`vm.setFilter(...)`, `vm.resume(entry)`). Bez `useQuery` i bez obliczeń domenowych.

Każdy taki ekran to katalog z `index.tsx` (wejście widoku), więc importy tras się nie zmieniają:

```
features/tasks/tasks-page/
├── index.tsx          # TasksPage: układ strony, sekcje
├── use-tasks.ts       # useTasksViewModel
├── task-filters.tsx   # widoki sekcji, każdy dostaje { vm }
├── task-row.tsx
└── …
```

W tym układzie są: Dziś (`time-entries/components/today`), formularz wpisu (`entry-form`),
paleta poleceń (`commands`), Zadania, strona zadania, Raporty, Sprinty i podsumowanie dnia.

Wspólne klocki widoków są w `src/components/ui`: `StatGrid`/`StatTile` (liczby nad stroną),
`Panel` (karta sekcji z nagłówkiem), `ProgressBar`, `Kbd`, `ActionMenu`. Formatowanie
(czas, SP, daty, godziny 12h/24h, przedziały godzin, różnice wobec estymaty) daje
`useFormat()` z `src/i18n/context.tsx`, a nie lokalne funkcje w komponentach.

## 5. Uwierzytelnianie

- Login (username lub e-mail) + hasło; hasła **scrypt** (N=2^15, r=8, p=3 wg OWASP) z wbudowanego `node:crypto`.
- **Google**: OAuth 2.0 z kodem autoryzacyjnym i PKCE, weryfikacja `id_token` kluczami Google (JWKS);
  konto z tym samym zweryfikowanym e-mailem dostaje powiązanie zamiast duplikatu.
- Access token (JWT HS256, 15 min) w pamięci przeglądarki + refresh token (30 dni) w ciasteczku
  httpOnly `SameSite=Lax` ograniczonym do `/api/v1/auth`. Refresh tokeny są rotowane, w bazie leży tylko
  ich SHA-256, a ponowne użycie starego tokenu unieważnia całą rodzinę sesji.
- Endpointy z ciasteczkiem przyjmują żądania tylko z naszej strony (sprawdzanie `Origin`).
- Blokada konta na 15 min po 10 błędnych hasłach, limity prób w pamięci procesu (przy kilku maszynach: Redis).
- Reset hasła: jednorazowy token (60 min) e-mailem; po zmianie hasła wszystkie sesje wygasają.

## 6. Płatności (następny krok)

- Stripe Checkout dla Pro (miesięcznie/rocznie) i Lifetime (jednorazowo), Customer Portal do zarządzania subskrypcją.
- Stripe jest źródłem prawdy; `users.plan` aktualizują wyłącznie webhooki (idempotentne).

## 7. Wdrożenie

- Obraz multi-stage na `node:24-alpine`, uruchamiany jako użytkownik `node`, z `HEALTHCHECK` na `/api/v1/health`.
- Konfiguracja wyłącznie przez zmienne środowiskowe (`.env.example`); ten sam obraz działa na Fly.io,
  w `docker compose` i później w Kubernetesie (ConfigMap/Secret).
