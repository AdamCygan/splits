# Architektura — decyzje

Krótkie zapisy decyzji (ADR-lite): co wybraliśmy i dlaczego.

## 1. Jedna aplikacja w TypeScripcie (strony + API)

Strony (TanStack Start, SSR) i API (`/api/v1`) działają w jednym procesie Node i wdrażają się
jako jeden obraz. Jeden język, jeden zestaw typów i jedno wdrożenie zamiast dwóch aplikacji.

- `src/routes/api/v1/$.ts` przekazuje każde żądanie `/api/v1/*` do aplikacji **Hono** (`src/server/app.ts`).
  Import jest dynamiczny, więc kod serwera (baza, hasła, tokeny) nie trafia do bundla przeglądarki.
- Kod jest podzielony **per funkcja** (`src/features/<obszar>`), a w środku na warstwy — patrz
  „Warstwy funkcji” niżej. Trasy API to `controllers/routes.server.ts` (tylko HTTP: wejście,
  ciasteczka, odpowiedź), zapytania i transakcje to `data/*.server.ts` (repozytoria Drizzle).
- Reguły biznesowe są w `domain/` każdej funkcji (wspólne w `src/shared/domain`) i **te same funkcje**
  sprawdzają formularz w przeglądarce i dane na serwerze (np. `validateEntry`, `validateScale`,
  `missingCadenceSprints`).
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

### Warstwy funkcji

Każda funkcja (`account`, `auth`, `billing`, `time-entries`, `sprints`, `projects`, …) ma ten sam układ:

```
src/features/billing/
├── domain/        # plans.ts: plany, ceny, limity Free, enumy — czyste funkcje z testami
├── data/
│   ├── dto.ts                 # typy DTO + schematy Zod odpowiedzi API (wspólne: klient i serwer)
│   ├── api.ts                 # klient HTTP tej funkcji (billingApi)
│   ├── queries.ts             # zapytania TanStack Query
│   ├── repository.server.ts   # baza: zapytania i transakcje (Drizzle), Stripe
│   ├── inputs.server.ts       # schematy wejścia API
│   └── mappers.server.ts      # wiersz bazy → DTO
├── controllers/
│   ├── use-billing.ts         # view-model: mutacje, przekierowania, stan ekranu
│   └── routes.server.ts       # trasy Hono: parsowanie, limity, ciasteczka, odpowiedź
└── views/         # komponenty React: tylko wyświetlanie i wywoływanie akcji
```

Zależności idą w jedną stronę: `views → controllers → data / domain`. ESLint pilnuje granic:

- widok nie importuje `data/api` ani `useDataMutation` (wywołania API i mutacje są w kontrolerach),
- `domain/` nie importuje Reacta, sieci, kontrolerów ani widoków (wolno tylko typy z `data/dto`),
- trasy (`controllers/*.server.ts`) nie importują Drizzle ani `#/server/db` — bazę obsługuje `data/`,
- kod przeglądarki nie importuje `*.server.ts` ani `#/server/*`.

Wspólne rzeczy bez jednej funkcji są w `src/shared` (`domain`: daty, liczby, tekst, CSV, markdown;
`data`: pomocnicze HTTP, klucze zapytań, mutacje; `controllers`: archiwizacja, ostrzeżenie o zmianach).
`src/server` to platforma: aplikacja Hono, baza, middleware HTTP, e-mail, zadania w tle.

Większe ekrany mają view-model (`use-x.ts` w `controllers/`), który zwraca jeden obiekt `vm`,
a widoki (`views/<ekran>/index.tsx` i sekcje) dostają `{ vm }` i tylko renderują.

Wspólne klocki widoków są w `src/components/ui`: `StatGrid`/`StatTile` (liczby nad stroną),
`Panel` (karta sekcji z nagłówkiem), `ProgressBar`, `Kbd`, `ActionMenu`. Formatowanie
(czas, SP, daty, godziny 12h/24h, przedziały godzin, różnice wobec estymaty) daje
`useFormat()` z `src/i18n/context.tsx`, a nie lokalne funkcje w komponentach.

### Konwencje kodu i testów

Pilnuje ich ESLint (`no-restricted-syntax` i `consistent-type-definitions` w `eslint.config.js`):

- **Propsy i opcje to nazwane interfejsy**, a w sygnaturze tylko destrukturyzacja:
  `interface StatTileProps { … }` i `function StatTile({ label, value }: StatTileProps)`.
  Bez typów obiektowych wpisanych w parametr. Kształty obiektów to `interface`, nie `type`.
- **Bez IIFE** (`(() => …)()`): logika idzie do nazwanej funkcji, w JSX do osobnego komponentu.
- **Tytuły testów zaczynają się od „Should”**: `it('Should reject a duplicate username')`.
- **Przypadki testowe przez `it.each`** (Vitest) albo `testEach` (Playwright, `tests/e2e/helpers.ts`),
  nie przez pętlę. W treści testu nie ma pętli z asercjami: wyniki zbieramy
  (`Promise.all`, `inSequence` z `tests/support/sequence.ts`) i sprawdzamy jedną asercją.

## 5. Uwierzytelnianie

- Login (username lub e-mail) + hasło; hasła **scrypt** (N=2^15, r=8, p=3 wg OWASP) z wbudowanego `node:crypto`.
- **Google**: OAuth 2.0 z kodem autoryzacyjnym i PKCE, weryfikacja `id_token` kluczami Google (JWKS);
  konto z tym samym zweryfikowanym e-mailem dostaje powiązanie zamiast duplikatu.
- Access token (JWT HS256, 15 min) w pamięci przeglądarki + refresh token (30 dni) w ciasteczku
  httpOnly `SameSite=Lax` ograniczonym do `/api/v1/auth`. Refresh tokeny są rotowane, w bazie leży tylko
  ich SHA-256, a ponowne użycie starego tokenu unieważnia całą rodzinę sesji.
- Endpointy z ciasteczkiem przyjmują żądania tylko z naszej strony (`Origin` i `Sec-Fetch-Site`).
- Blokada konta na 15 min po 10 błędnych hasłach, limity prób w pamięci procesu (przy kilku maszynach: Redis).
  Adres IP do limitów pochodzi tylko z nagłówka ustawianego przez proxy hostingu (`CLIENT_IP_HEADER`,
  domyślnie `X-Real-IP` na Railway); innych nagłówków klient może użyć do podszycia się pod inny adres.
- Reset hasła: jednorazowy token (60 min) e-mailem; po zmianie hasła wszystkie sesje wygasają.
- Sekret 2FA zaszyfrowany AES-256-GCM z pełnym, 16-bajtowym tagiem.

## 5a. Nagłówki i ochrona przeglądarki

- Strony: Content-Security-Policy z nonce'em losowanym dla każdego żądania (`src/server.ts`,
  `src/server/security-headers.ts`). Nonce trafia do routera (`ssr.nonce`), więc dostają go skrypty
  hydracji, skrypt motywu i JSON-LD; wstrzyknięty skrypt bez nonce'a się nie wykona. Style mają
  `'unsafe-inline'` (atrybuty `style` z Reacta). Do tego HSTS, `X-Frame-Options: DENY`,
  `frame-ancestors 'none'`, `nosniff`, COOP/CORP i Permissions-Policy.
- API: `default-src 'none'`, HSTS, `Cache-Control: no-store`, limit ciała żądania 1 MB.
- Linki zadań: serwer przyjmuje tylko `http(s)`, a widoki i tak przepuszczają je przez `safeUrl`.
- `/.well-known/security.txt` i `SECURITY.md`: jak zgłosić podatność.
- CI (`.github/workflows/security.yml`): CodeQL, Semgrep, gitleaks, `pnpm audit`, Dependency Review;
  Dependabot aktualizuje npm, akcje (przypięte do commitów) i obraz Dockera.

## 6. Płatności (następny krok)

- Stripe Checkout dla Pro (miesięcznie/rocznie) i Lifetime (jednorazowo), Customer Portal do zarządzania subskrypcją.
- Stripe jest źródłem prawdy; `users.plan` aktualizują wyłącznie webhooki (idempotentne).

## 7. Wdrożenie

- Obraz multi-stage na `node:24-alpine`, uruchamiany jako użytkownik `node`, z `HEALTHCHECK` na `/api/v1/health`.
- Konfiguracja wyłącznie przez zmienne środowiskowe (`.env.example`); ten sam obraz działa na Fly.io,
  w `docker compose` i później w Kubernetesie (ConfigMap/Secret).
