# Timeblame — time tracker dla programistów

Szybkie notowanie czasu na zadaniach, Code Review, pair programmingu i pracach dodatkowych.
Story pointy, sprinty i analityka per dzień, sprint, miesiąc i zadanie.

> Marka „Timeblame” żyje w `src/config/site.ts` (nazwa, opis, adres).

Cała aplikacja to **jeden projekt w TypeScripcie**: strony (SSR) i API (`/api/v1`) działają
w jednym procesie Node i wdrażają się jako jeden obraz Dockera.

## Stack

| Warstwa   | Technologia                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------ |
| Strony    | TanStack Start (SSR) + Router + Query + Form, TailwindCSS 4, Radix, Zod                                      |
| API       | Hono pod `/api/v1` (w tym samym procesie co strony), walidacja Zod                                           |
| Baza      | PostgreSQL 18 (działa też na 16 i 17), lokalnie albo na [Neon](https://neon.com); Drizzle ORM + migracje SQL |
| Logowanie | e-mail + hasło (scrypt), Google (OAuth 2.0 + PKCE), JWT 15 min + refresh token z rotacją                     |
| E-maile   | Resend (reset hasła); bez klucza e-maile lądują w logu serwera                                               |
| Analityka | PostHog (tylko po zgodzie na cookies)                                                                        |
| Hosting   | Fly.io (Frankfurt) + Neon, alternatywnie dowolny serwer z Dockerem                                           |

## Struktura repozytorium

```
time-tracker/
├── src/
│   ├── routes/                 # routing plikowy: _marketing, _auth, app/, api/v1/$ (całe API)
│   ├── features/<obszar>/      # każda funkcja w warstwach (clean architecture):
│   │   ├── domain/             #   czyste reguły, enumy, walidacje (bez Reacta i sieci, z testami)
│   │   ├── data/               #   dto.ts (typy + Zod), api.ts (klient), queries.ts,
│   │   │                       #   *.server.ts: repozytoria (Drizzle, transakcje), wejścia, mapery
│   │   ├── controllers/        #   use-*.ts (view-modele), routes.server.ts (trasy Hono)
│   │   └── views/              #   komponenty React: tylko wyświetlanie
│   ├── shared/                 # wspólne: domain (daty, liczby, CSV), data (HTTP, klucze, mutacje)
│   ├── server/                 # platforma serwera: app.ts (Hono), db/, http/, e-mail, zadania
│   ├── i18n/messages/          # teksty EN/PL
│   └── config/                 # site.ts (marka), legal.ts (dane do regulaminu)
├── drizzle/                    # migracje SQL (generowane: pnpm db:generate)
├── tests/unit|api|e2e          # Vitest (domena), Vitest + Postgres (API), Playwright + axe
├── Dockerfile, fly.toml        # jeden obraz, jedna aplikacja na Fly.io
├── compose.yaml                # lokalnie: Postgres + aplikacja
├── docs/                       # architektura, pierwotny projekt schematu
└── marketing/                  # film promocyjny, obraz OG, teksty reklam
```

## Uruchomienie

Wymagany **Node 24**, **pnpm 12** (wersja w `package.json` → `packageManager`) i Postgres 16+.
pnpm zainstalujesz przez `npm install -g pnpm@12.16.1` albo `corepack enable` (Corepack sam weźmie wersję z `package.json`).

### Wariant A: wszystko w Dockerze

```bash
cp .env.example .env
# ustaw JWT_SECRET:  openssl rand -base64 48
docker compose up -d --build      # http://localhost:3000
```

Po zmianach w kodzie: `docker compose up -d --build app` (bez `--build` zostaje stary obraz).

### Wariant B: baza w Dockerze, aplikacja z terminala (hot reload)

```bash
docker compose up -d db
cp .env.example .env              # DATABASE_URL wskazuje na bazę z compose
pnpm install
pnpm dev                          # http://localhost:3000, migracje wgrywają się same
```

Zamiast Dockera możesz od razu wpisać w `DATABASE_URL` adres bazy z Neona (osobna gałąź
`dev` w Neonie, żeby nie ruszać danych produkcyjnych).

### Baza i migracje

```bash
pnpm db:generate      # po zmianie src/server/db/schema.ts: nowa migracja SQL w drizzle/
pnpm db:migrate       # wgraj migracje ręcznie (serwer i tak robi to przy starcie)
pnpm db:studio        # podgląd danych w przeglądarce
```

Migracje wykonują się przy starcie serwera, pod blokadą w Postgresie (bezpieczne przy kilku maszynach).
Wyłączysz to zmienną `MIGRATE_ON_START=false`.

## Język i dostępność

- Aplikacja jest domyślnie **po angielsku**, polski jest drugim językiem (przełącznik w stopce
  i w Ustawienia → Account; wybór zapisuje się w ciasteczku `app_locale`).
- Teksty są w `src/i18n/messages/*.ts` jako pary `en`/`pl` z tym samym kształtem,
  więc brak tłumaczenia to błąd TypeScriptu.
- Dostępność (cel: WCAG 2.2 AA, czyli też EN 301 549 z Europejskiego Aktu o Dostępności):
  link „przejdź do treści”, ogłaszanie zmiany strony, natywne kontrolki formularzy, okna
  z pułapką fokusu i powrotem fokusu, przyciski „w górę / w dół” zamiast przeciągania,
  kolor nigdy nie jest jedyną informacją, tryb wysokiego kontrastu (`forced-colors`),
  `prefers-reduced-motion`, fokus nie chowa się pod przyklejonymi paskami (`scroll-padding`).
- Deklaracja dostępności: `/accessibility` (`src/features/legal/domain/accessibility.ts`). Przy każdym
  przeglądzie zmień `UPDATED` i uczciwie opisz znane ograniczenia.
- Testy: każdy test e2e kończy się sprawdzeniem axe-core, a `tests/e2e/a11y.spec.ts` przechodzi
  przez **wszystkie strony** (oba motywy, komputer i telefon, reguły WCAG 2.2 AA + dobre praktyki),
  sprawdza układ przy 320 px bez przewijania w bok, tryb wysokiego kontrastu, odnośnik
  „przejdź do treści” i widoczność fokusu pod paskami. **Nowa strona = wpis w listach w tym pliku.**
- Zasady przy zmianach w UI: każda kontrolka ma nazwę (etykieta albo `aria-label` zawierający
  widoczny tekst), cel kliknięcia min. 24×24 px, przewijane w bok kontenery z tabelami mają
  `relative overflow-x-auto` (inaczej ukryte podpisy `sr-only` wypychają stronę w bok),
  zaznaczenie nie może opierać się tylko na tle (w trybie wysokiego kontrastu tła znikają).

## Co jest w panelu

- **Today** – timer bez godziny końca (start teraz albo od podanej godziny, zatrzymanie z paska
  widocznego na każdej stronie, „Wznów” przy wpisie), szybkie wpisy prawym przyciskiem na rodzaju
  pracy (15 min…2 h albo własny czas), szablony pod Alt+1…9, podsumowanie zadania z własnego
  szablonu (Ustawienia → Task summaries), formularz wpisu czasu dopasowany do rodzaju pracy (zadanie, Code Review,
  Pair programming, prace dodatkowe, spotkania, własne typy), czas od–do albo czas trwania
  (`45`, `1:30`, `1h 15m`), story pointy ze skali z podpowiedzią z czasu, projekt
  i **notatki** (co zrobiłem, decyzje, blokery; do 2000 znaków). Notatki można dopisać
  później („Add notes”). Ctrl + Enter zapisuje. **Nadgodziny**: przełącznik w formularzu, ile z czasu
  wpisu było po godzinach (puste pole = cały wpis) i obowiązkowy opis, co wtedy było robione.
  Nadgodziny są częścią czasu wpisu (sumy się nie dublują), mają plakietkę na liście dnia, osobną
  sumę w raportach, na stronach Zadania i Sprinty, kolumny w CSV i pole `{overtime}` w podsumowaniu.
  Działający timer nie ma jeszcze nadgodzin: oznacza się je po zatrzymaniu.
- **Tasks** – wszystkie zadania z okresu: łączny czas, SP, nadgodziny, czy zadanie zmieściło się
  w przedziale skali SP, wyszukiwanie, filtry, „Kontynuuj” i podsumowanie.
- **Sprints** – bieżący sprint (dzień sprintu, czas, SP względem pojemności, czas na SP, podział
  na typy pracy) i porównanie zakończonych sprintów ze średnim czasem na SP.
- **Admin** (rola `admin`) – statystyki (aktywni wg wpisów czasu, przychód z faktycznych wpłat minus
  zwroty, problemy z płatnością), lista kont z sortowaniem, filtrami w adresie strony i eksportem CSV.
  Osobna strona konta (`/app/admin/users/:id`): plan, rola, blokada, bezpieczeństwo (potwierdzenie
  e-maila, oczekująca zmiana adresu, 2FA z wyłączeniem po utracie telefonu, zalogowane urządzenia),
  płatności (subskrypcja, link do Stripe, faktury), historia zmian i usunięcie po wpisaniu adresu konta.
  Dziennik zmian (`/app/admin/log`) z filtrami i stronicowaniem; trafia do niego każda zmiana i wgląd
  w faktury. `ADMIN_REQUIRE_2FA=true` zamyka panel adminom bez logowania dwuetapowego.
  Administrator nie widzi treści wpisów i ma wszystko z Pro bez płacenia.
  Siebie (właściciela) ustawiasz zmienną `ADMIN_EMAILS=ty@firma.pl`: po zalogowaniu z potwierdzonym
  adresem (Google albo reset hasła) konto dostaje rolę admin, a inni administratorzy nie mogą go
  zablokować, usunąć ani odebrać mu roli. Alternatywa w bazie:
  `UPDATE users SET role = 'admin' WHERE email = 'ty@firma.pl';`
- **Demo** – `/demo` otwiera konto z przykładowymi danymi bez rejestracji (bez płatności i zmian
  konta, usuwane po 24 h).
- **Settings** – przegląd z listą kroków, dzień pracy, sprinty (kadencja z podglądem,
  lista, sprinty ręczne), skala SP, rodzaje pracy z podglądem formularza, statusy zadań,
  projekty i tagi, szybkie szablony (Alt+1…9), konto (zmiana hasła, eksport danych do JSON,
  usunięcie konta), plan.
- **Reports** – story pointy, czas i nadgodziny per zadanie za sprint albo dowolny okres, podział na
  rodzaje pracy, eksport CSV (Pro).
- **Konto** – rejestracja, logowanie e-mailem albo przez Google, reset hasła e-mailem, sesja odnawiana
  w tle (refresh token w ciasteczku httpOnly, rotowany przy każdym użyciu).

## Dokumenty prawne i cookies

- Regulamin (`/terms`), polityka prywatności (`/privacy`), polityka cookies (`/cookies`) i deklaracja dostępności (`/accessibility`) po polsku i po angielsku:
  `src/features/legal/domain/*.ts`.
- **Przed publikacją uzupełnij `src/config/legal.ts`** (dane firmy z CEIDG/KRS, adres, NIP, e-mail do spraw
  danych, faktyczni dostawcy hostingu, bazy i e-maili) i daj dokumenty do przejrzenia prawnikowi.
- Baner cookies: statystyki (PostHog) ładują się wyłącznie po zgodzie; wybór w ciasteczku `app_consent`
  (12 miesięcy), zmiana w stopce przez „Cookie settings”.

## Płatności (Stripe: Free, Pro miesięcznie, Pro rocznie)

Cennik ma trzy kafelki: **Free**, **Pro miesięcznie (6 USD)** i **Pro rocznie (60 USD, 2 miesiące gratis)**,
ceny z VAT, jeśli dotyczy. Oba warianty Pro mają te same funkcje; różni je tylko okres płatności.
Nie ma okresów próbnych: do oglądania jest demo (konta demo mają Pro).

Plan Free jest mocno przycięty (limity w `FREE_LIMITS`, `src/features/billing/domain/plans.ts`, pilnowane przez API):
historia i raporty z 7 dni, 1 projekt, 2 szybkie szablony, 4 domyślne statusy, tylko wbudowane typy pracy,
bez eksportu CSV i bez codziennych przypomnień e-mail.

Jak to działa:

1. Cennik → „Kup Pro miesięcznie / rocznie” → rejestracja albo logowanie → **koszyk** (`/app/checkout`):
   wybór okresu (miesiąc albo rok), podsumowanie, data odnowienia, zgoda na regulamin i 14 dni na pełny zwrot.
2. „Przejdź do płatności” otwiera **Stripe Checkout** (karta, adres, NIP firmy, kod rabatowy).
3. Po płatności wracasz do Ustawienia → Plan; plan włącza się od razu (`POST /api/v1/billing/sync`),
   a webhook (`/api/v1/stripe/webhook`) pilnuje odnowień, nieudanych płatności i anulowania, a wpłaty
   i zwroty (`charge.succeeded`, `charge.refunded`) zapisuje do przychodu w panelu admina.
   Po aktualizacji uruchom ponownie `pnpm stripe:setup`, żeby webhook dostał nowe zdarzenie.
4. Ustawienia → Plan → „Zarządzaj subskrypcją” otwiera **Stripe Customer Portal**: faktury, karta,
   dane do faktury, zmiana okresu miesiąc ↔ rok (z proporcjonalnym rozliczeniem) i wyłączenie odnowienia
   (dostęp zostaje do końca opłaconego okresu).
5. **Zwrot** (14 dni z regulaminu): zrób pełny zwrot płatności w panelu Stripe. Webhook `charge.refunded`
   sam kończy subskrypcję i przełącza konto na Free, więc nie będzie kolejnego obciążenia.
   Częściowy zwrot (np. rabat) niczego nie wyłącza.

Konfiguracja (najpierw w trybie testowym, klucz `sk_test_…`):

```bash
STRIPE_SECRET_KEY=sk_test_… APP_URL=https://timeblame.com pnpm stripe:setup
# tworzy produkt „Timeblame Pro” z dwiema cenami (lookup keys timeblame_pro_monthly i timeblame_pro_yearly),
# wyłącza stare ceny, ustawia portal klienta (zmiana okresu) i webhook; wypisuje STRIPE_WEBHOOK_SECRET
# Sekrety STRIPE_SECRET_KEY i STRIPE_WEBHOOK_SECRET ustaw w zmiennych serwisu na Railway.
# Opcjonalnie STRIPE_PRICE_PRO_MONTHLY / STRIPE_PRICE_PRO_YEARLY wymuszają konkretne price_…
```

Lokalnie webhooki przekazuje Stripe CLI: `stripe listen --forward-to localhost:3000/api/v1/stripe/webhook`
(wypisany sekret wpisz do `.env`). Testowa karta: `4242 4242 4242 4242`, dowolna przyszła data i CVC.

W panelu Stripe włącz jeszcze: przypomnienia o odnowieniu (7 dni przed) i e-maile z fakturą
(Settings → Billing → Subscriptions and emails), a gdy sprzedajesz konsumentom w UE: Stripe Tax
i `STRIPE_AUTOMATIC_TAX=true` (VAT OSS). Zmiana ceny = nowa kwota w `PRO_PRICES` (`src/features/billing/domain/plans.ts`)
i ponowne `pnpm stripe:setup` (nowa cena przejmuje lookup key, stara zostaje wyłączona).

## Przed startem: `pnpm check:launch`

Sprawdza, czy w `src/config/legal.ts` i `src/config/site.ts` nie zostały placeholdery (dane firmy,
NIP, adres, dostawcy) ani adresy `@example.com`, i czy `fly.toml` ma jedną domenę w `APP_URL`,
`VITE_APP_URL` i `EMAIL_FROM`. Przechodzi dopiero, gdy wszystko jest prawdziwe. Serwer produkcyjny
z placeholderami też ostrzega (w logach i w Sentry).

## Hosting i wdrożenie: Fly.io + Neon

| Co                       | Gdzie                                                  | Koszt / mies. (start)     |
| ------------------------ | ------------------------------------------------------ | ------------------------- |
| Aplikacja (strony + API) | Fly.io, 1 maszyna `shared-cpu-1x` 512 MB, Frankfurt    | ok. 3–5 $                 |
| Baza                     | Neon Free (1 GB danych, usypia się po 5 min bez ruchu) | 0 $                       |
| Domena                   | dowolny rejestrator                                    | ok. 1 $ (10–15 $ rocznie) |
| E-maile                  | Resend Free (3000 / mies.)                             | 0 $                       |

1. **Neon**: projekt w regionie _AWS Europe Central 1 (Frankfurt)_, Postgres 18. Skopiuj adres z _Connect_
   (bez _Connection pooling_) i zamień końcówkę `?sslmode=require&channel_binding=require` na `?sslmode=verify-full`.
2. **Fly.io**: `curl -L https://fly.io/install.sh | sh` (Windows: `iwr https://fly.io/install.ps1 -useb | iex`),
   potem `fly auth signup` albo `fly auth login`.
3. **Aplikacja** (w katalogu głównym repozytorium). W `fly.toml` wpisz własną nazwę w `app` oraz
   `https://<nazwa>.fly.dev` w `APP_URL` i `VITE_APP_URL`, potem:
   ```bash
   fly apps create <nazwa>
   fly secrets set DATABASE_URL="postgresql://…@ep-….eu-central-1.aws.neon.tech/neondb?sslmode=verify-full" \
                   JWT_SECRET="$(openssl rand -base64 48)"
   fly deploy --ha=false                       # jedna maszyna (domyślnie Fly stawia dwie)
   curl https://<nazwa>.fly.dev/api/v1/health  # {"status":"ok"}
   ```
4. **Domena**: `fly certs add timeblame.com`, a u rejestratora rekordy DNS z `fly certs show`.
5. **Google** (opcjonalnie): w Google Cloud Console utwórz _OAuth client ID_ (Web application) z adresem
   przekierowania `https://timeblame.com/api/v1/auth/google/callback`, potem
   `fly secrets set GOOGLE_CLIENT_ID=… GOOGLE_CLIENT_SECRET=…`. Przycisk „Continue with Google” pojawi się sam.
6. **E-maile**: zweryfikuj domenę w Resend i `fly secrets set RESEND_API_KEY=…`.
7. **Błędy**: załóż projekt w Sentry w regionie UE (sentry.io, _Data Storage Location: EU_), platforma Node,
   i `fly secrets set SENTRY_DSN=https://…@o….ingest.de.sentry.io/…`. Trafiają tam błędy 5xx API,
   nieudane webhooki Stripe (znacznik `area: stripe-webhook`) i ostrzeżenie startowe. Bez SDK, bez danych
   z treści wpisów i bez adresów IP. W Sentry ustaw alert e-mailem na każdy nowy problem.
8. **Automatyczne wdrożenia**: GitHub Actions tylko testuje (`.github/workflows/ci.yml`: typy, lint, testy
   jednostkowe i API z Postgresem, e2e z axe). Wdraża hosting z gałęzi `main`: na Railway to wbudowane
   automatyczne wdrożenia; na Fly.io włącz je w panelu (GitHub → Deploy) albo uruchamiaj `fly deploy`.
   Na Railway warto zaznaczyć „Wait for CI”, żeby wdrażał tylko commity z zielonym CI.

Ten sam obraz działa też na dowolnym serwerze z Dockerem (`docker compose up -d --build`) i na Railway.

## SEO i wydajność

Strona główna, cennik i rejestracja mają w Lighthouse 100 w wydajności, dostępności,
dobrych praktykach i SEO (telefon i desktop). Co za tym stoi:

- render po stronie serwera, HTML i statyki kompresowane (gzip/brotli), długi cache dla plików z hashem,
- font podzielony na dwa małe podzbiory (63 KB zamiast 185 KB), preload i font zastępczy z dopasowanymi metrykami (zero skoków układu),
- landing nie ładuje Zod, TanStack Query ani PostHoga przy starcie; PostHog dociąga się, gdy przeglądarka jest bezczynna,
- sekcje poniżej pierwszego ekranu z `content-visibility: auto`, hydracja podzielona granicami `<Suspense>`,
- film jako lekki poster AVIF; MP4 pobiera się dopiero po kliknięciu,
- `robots.txt`, `sitemap.xml`, canonical, Open Graph, Twitter Card i dane strukturalne (SoftwareApplication, FAQPage, VideoObject).

**Przed wdrożeniem ustaw `VITE_APP_URL` na docelową domenę** (build arg w `compose.yaml`).
Od niej zależą canonical, sitemap, Open Graph i dane strukturalne.

## Bezpieczeństwo

Opis zabezpieczeń: `docs/architecture.md` (sekcje 5 i 5a), zgłaszanie podatności: `SECURITY.md`.
Przy każdym pushu działa `.github/workflows/security.yml` (CodeQL, Semgrep, gitleaks, `pnpm audit`).
Na Railway adres klienta do limitów prób przychodzi w `X-Real-IP` (domyślne `CLIENT_IP_HEADER`);
na Fly.io ustaw `CLIENT_IP_HEADER=fly-client-ip`.

## Przydatne komendy

```bash
pnpm typecheck && pnpm lint && pnpm build
pnpm test                # Vitest: domena (unit) + API na Postgresie (api, baza TEST_DATABASE_URL)
pnpm test:e2e            # Playwright + axe na buildzie produkcyjnym (najpierw pnpm build)
pnpm add <paczka>        # nowa zależność (pnpm-lock.yaml zmienia się razem z package.json)
docker compose logs -f app
docker compose down      # stop
docker compose down -v   # stop + usunięcie danych bazy
```

Testy API i e2e czyszczą swoje bazy (`splits_test`, `splits_e2e`) przed startem; nie wskazuj ich na bazę z danymi.

## Plan prac

1. ✅ Schemat bazy i migracje (Drizzle)
2. ✅ API: konta, logowanie Google, reset hasła, ustawienia, sprinty, wpisy i timer, szablony
3. ✅ UI: landing, logowanie, panel ustawień, wpisy z notatkami, timer, podsumowania, raporty
4. ✅ Płatności Stripe: koszyk, Checkout, Customer Portal, webhooki, plany tylko roczne, limity Free na serwerze
5. ⏳ Organizacje i plan Team (płatność za osobę)
6. ✅ Strony Zadania i Sprinty, eksport danych (RODO), demo bez rejestracji, panel admina, nadgodziny
7. ⏳ Przypomnienia, integracje z Jirą i GitHubem
