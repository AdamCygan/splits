-- UWAGA: pierwotny projekt schematu (z czasów backendu .NET), zostawiony jako dokumentacja.
-- Aktualny schemat jest w src/server/db/schema.ts, a migracje w drizzle/.
-- =====================================================================
--  Time tracker SaaS — schemat bazy danych (PostgreSQL 16+)
--  KROK 1 — wersja 2 (po uwagach): model PER UŻYTKOWNIK, bez organizacji.
--
--  Konwencje:
--   * snake_case, klucze UUID v7 generowane w .NET (Guid.CreateVersion7()).
--   * Wszystkie znaczniki czasu w UTC (timestamptz). Dzień pracy (work_date)
--     liczony w strefie czasowej użytkownika i zapisywany jawnie.
--   * Każdy rekord domenowy ma user_id (właściciela). Powiązania między
--     tabelami idą przez złożone klucze (id, user_id) — baza sama nie pozwoli
--     podpiąć zadania pod status, sprint czy projekt innego użytkownika.
--   * updated_at ustawia interceptor EF Core (SaveChanges), nie triggery.
--   * Docelowo: encje EF Core + migracje (Npgsql) — krok 3.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS citext;      -- login/e-mail bez rozróżniania wielkości liter
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- zakaz nakładania się sprintów
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- szybkie wyszukiwanie zadań w formularzu

-- ---------------------------------------------------------------------
--  ENUMY
-- ---------------------------------------------------------------------
-- Role na poziomie aplikacji:
--   client  — zwykły użytkownik (trackuje własny czas)
--   manager — back-office: podgląd użytkowników i płatności, zwroty, wsparcie;
--             bez zmiany ról i konfiguracji systemu
--   admin   — pełny dostęp (Ty), w tym nadawanie ról
CREATE TYPE user_role           AS ENUM ('client', 'manager', 'admin');
CREATE TYPE auth_provider       AS ENUM ('google');
CREATE TYPE auth_token_purpose  AS ENUM ('email_verification', 'password_reset');
CREATE TYPE task_kind           AS ENUM ('task', 'code_review', 'pair_programming',
                                         'additional_work', 'meeting', 'custom');
CREATE TYPE field_requirement   AS ENUM ('hidden', 'optional', 'required');
CREATE TYPE time_input_mode     AS ENUM ('range', 'duration');      -- start–koniec albo sam czas
CREATE TYPE status_category     AS ENUM ('todo', 'in_progress', 'done');
CREATE TYPE time_entry_source   AS ENUM ('manual', 'timer', 'template', 'import');
CREATE TYPE plan_code           AS ENUM ('free', 'pro', 'lifetime');
CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due',
                                         'canceled', 'incomplete', 'unpaid');

-- =====================================================================
--  MODUŁ A — UŻYTKOWNICY I AUTENTYKACJA
--  Domyślna metoda: login (username lub e-mail) + hasło.
--  Google OAuth jako opcja dodatkowa; konto z Google może potem ustawić hasło.
-- =====================================================================
CREATE TABLE users (
    id                   uuid PRIMARY KEY,
    username             citext NOT NULL UNIQUE
                         CHECK (username ~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,29}$'),
    email                citext NOT NULL UNIQUE,
    password_hash        text,              -- ASP.NET Identity PasswordHasher (PBKDF2); NULL = konto tylko z Google
    role                 user_role NOT NULL DEFAULT 'client',
    display_name         text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 80),
    avatar_url           text,
    email_verified_at    timestamptz,
    failed_login_count   smallint NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
    lockout_until        timestamptz,       -- blokada po serii błędnych haseł (ochrona przed brute force)
    password_changed_at  timestamptz,
    last_login_at        timestamptz,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),
    deleted_at           timestamptz        -- soft delete (RODO: anonimizacja po 30 dniach)
);

-- Panel konfiguracji użytkownika: norma dnia, kalendarz pracy, przypomnienia.
-- (Skala story pointów jest osobno — tabela story_point_scale.)
CREATE TABLE user_settings (
    user_id                  uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    workday_target_minutes   smallint NOT NULL DEFAULT 480
                             CHECK (workday_target_minutes BETWEEN 0 AND 1440),  -- cel dzienny (pasek postępu)
    working_days             smallint[] NOT NULL DEFAULT '{1,2,3,4,5}',          -- 0=niedz. … 6=sob. (jak .NET DayOfWeek)
    week_starts_on           smallint NOT NULL DEFAULT 1 CHECK (week_starts_on BETWEEN 0 AND 6),
    time_rounding_minutes    smallint NOT NULL DEFAULT 0
                             CHECK (time_rounding_minutes IN (0, 1, 5, 10, 15, 30)),
    timezone                 text NOT NULL DEFAULT 'UTC',                         -- IANA, np. 'Europe/Warsaw'
    locale                   text NOT NULL DEFAULT 'en',
    daily_reminder_at        time,                                                -- "uzupełnij dzień"; NULL = wyłączone
    updated_at               timestamptz NOT NULL DEFAULT now(),
    CHECK (working_days <@ '{0,1,2,3,4,5,6}'::smallint[] AND cardinality(working_days) BETWEEN 1 AND 7)
);

CREATE TABLE user_external_logins (
    provider          auth_provider NOT NULL,
    provider_user_id  text NOT NULL,                 -- "sub" z Google
    user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at        timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (provider, provider_user_id)
);
CREATE INDEX ix_user_external_logins_user ON user_external_logins (user_id);

-- Refresh tokeny z rotacją: przechowujemy tylko hash; ponowne użycie
-- unieważnionego tokenu unieważnia całą rodzinę (wykrycie kradzieży).
CREATE TABLE refresh_tokens (
    id              uuid PRIMARY KEY,
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    family_id       uuid NOT NULL,
    token_hash      bytea NOT NULL UNIQUE,           -- SHA-256
    expires_at      timestamptz NOT NULL,
    revoked_at      timestamptz,
    replaced_by_id  uuid REFERENCES refresh_tokens(id),
    user_agent      text,
    ip              inet,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_refresh_tokens_user_active ON refresh_tokens (user_id) WHERE revoked_at IS NULL;

CREATE TABLE auth_tokens (                           -- weryfikacja e-maila, reset hasła
    id          uuid PRIMARY KEY,
    user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose     auth_token_purpose NOT NULL,
    token_hash  bytea NOT NULL UNIQUE,
    expires_at  timestamptz NOT NULL,
    used_at     timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
--  MODUŁ B — REJESTRACJA CZASU (wszystko należy do jednego użytkownika)
-- =====================================================================

-- Skala story pointów (konfigurowalna w panelu). Każdy próg to "do ilu
-- minut" dana wartość SP; dolną granicą jest próg poprzedniej wartości.
--
-- Domyślna skala zakładana przy rejestracji (Fibonacci):
--   SP:   0.5     1     2     3     5     8      13
--   do:   30min   1h    2h    4h    8h    16h    32h
-- Np. 3 SP = powyżej 2h i do 4h. Skala służy jako podpowiedź przy wyborze SP
-- w formularzu. Serwis pilnuje, żeby wyższe SP miały wyższy próg czasu.
CREATE TABLE story_point_scale (
    id           uuid PRIMARY KEY,
    user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    points       numeric(4,1) NOT NULL CHECK (points > 0 AND points <= 100),
    max_minutes  integer NOT NULL CHECK (max_minutes BETWEEN 1 AND 100000),
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, points),
    UNIQUE (user_id, max_minutes)
);

-- Projekty: opcjonalne grupowanie (np. "Payments", "Mobile").
CREATE TABLE projects (
    id                                uuid PRIMARY KEY,
    user_id                           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                              text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
    key                               text CHECK (key ~ '^[A-Z][A-Z0-9]{1,9}$'),  -- "PAY" → rozpoznaje PAY-123
    color                             text NOT NULL DEFAULT '#6366F1' CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
    archived_at                       timestamptz,
    created_at                        timestamptz NOT NULL DEFAULT now(),
    updated_at                        timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, name),
    UNIQUE (id, user_id)
);

-- Statusy zadań: domyślne + własne. Kategoria mówi analityce, co znaczy
-- status (np. własny "Zablokowane" = in_progress, "Wdrożone" = done).
--
-- Domyślne statusy zakładane przy rejestracji:
--   Do zrobienia (todo, is_default) · W trakcie (in_progress)
--   Do review (in_progress) · Gotowe (done)
CREATE TABLE task_statuses (
    id           uuid PRIMARY KEY,
    user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 30),
    category     status_category NOT NULL,
    color        text NOT NULL CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
    is_system    boolean NOT NULL DEFAULT false,     -- domyślne: można zmienić nazwę/kolor, nie można usunąć
    is_default   boolean NOT NULL DEFAULT false,     -- status nadawany nowym zadaniom
    sort_order   smallint NOT NULL DEFAULT 0,        -- kolejność kolumn na tablicy
    archived_at  timestamptz,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, name),
    UNIQUE (id, user_id),
    CHECK (NOT (is_default AND archived_at IS NOT NULL))
);
CREATE UNIQUE INDEX ux_task_statuses_one_default ON task_statuses (user_id) WHERE is_default;

-- Typy zadań = konfiguracja formularza. Każdy typ ma story pointy
-- (również Code Review), więc sprint sumuje SP ze wszystkich rodzajów pracy.
--
-- Typy systemowe zakładane przy rejestracji (wszystko edytowalne w panelu):
--  kind              | nazwa            | link                       | opis     | czas         | domyślne SP
--  task              | Zadanie          | optional "Link do zadania" | optional | start–koniec | 1
--  code_review       | Code Review      | required "Link do MR"      | hidden   | sam czas     | 0.5
--  pair_programming  | Pair Programming | hidden                     | hidden   | sam czas     | 1
--  additional_work   | Prace dodatkowe  | hidden                     | hidden   | sam czas     | 0.5
--  meeting           | Spotkanie        | hidden                     | optional | sam czas     | 0.5
CREATE TABLE task_types (
    id                       uuid PRIMARY KEY,
    user_id                  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind                     task_kind NOT NULL,
    name                     text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
    color                    text NOT NULL CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
    icon                     text NOT NULL DEFAULT 'circle',      -- nazwa ikony lucide
    is_system                boolean NOT NULL DEFAULT false,      -- systemowych nie da się usunąć (tylko ukryć/zmienić)
    title_label              text NOT NULL DEFAULT 'Tytuł',
    link_requirement         field_requirement NOT NULL DEFAULT 'optional',
    link_label               text NOT NULL DEFAULT 'Link',
    description_requirement  field_requirement NOT NULL DEFAULT 'optional',
    default_story_points     numeric(4,1) NOT NULL DEFAULT 1
                             CHECK (default_story_points > 0 AND default_story_points <= 100),  -- podpowiedź w formularzu (wartość ze skali)
    default_time_input       time_input_mode NOT NULL DEFAULT 'duration',
    counts_as_focus_work     boolean NOT NULL DEFAULT true,       -- KPI: "praca nad zadaniami" vs. reszta
    sort_order               smallint NOT NULL DEFAULT 0,
    archived_at              timestamptz,
    created_at               timestamptz NOT NULL DEFAULT now(),
    updated_at               timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, name),
    UNIQUE (id, user_id),
    CHECK (is_system OR kind = 'custom')                          -- własne typy zawsze jako 'custom'
);
CREATE UNIQUE INDEX ux_task_types_system_kind ON task_types (user_id, kind) WHERE is_system;

-- Kalendarz sprintów: kadencja (tydzień, 2 tygodnie, …) generuje sprinty.
CREATE TABLE sprint_cadences (
    id            uuid PRIMARY KEY,
    user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    length_days   smallint NOT NULL CHECK (length_days BETWEEN 1 AND 56),  -- 7 / 14 / 21 / 28
    anchor_date   date NOT NULL,                     -- start pierwszego sprintu
    name_pattern  text NOT NULL DEFAULT 'Sprint {n}',
    auto_create   boolean NOT NULL DEFAULT true,     -- job w tle tworzy kolejny sprint
    is_active     boolean NOT NULL DEFAULT true,
    created_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, user_id)
);
CREATE UNIQUE INDEX ux_sprint_cadences_active ON sprint_cadences (user_id) WHERE is_active;

-- Status sprintu (planowany/aktywny/zakończony) wyliczamy z dat.
CREATE TABLE sprints (
    id                     uuid PRIMARY KEY,
    user_id                uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cadence_id             uuid,
    number                 integer CHECK (number > 0),
    name                   text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
    goal                   text CHECK (char_length(goal) <= 500),
    starts_on              date NOT NULL,
    ends_on                date NOT NULL,            -- włącznie
    capacity_story_points  numeric(6,1) CHECK (capacity_story_points >= 0),  -- plan na sprint
    created_at             timestamptz NOT NULL DEFAULT now(),
    updated_at             timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, user_id),
    CHECK (ends_on >= starts_on),
    FOREIGN KEY (cadence_id, user_id) REFERENCES sprint_cadences (id, user_id) ON DELETE SET NULL (cadence_id),
    CONSTRAINT ex_sprints_no_overlap EXCLUDE USING gist (
        user_id WITH =,
        daterange(starts_on, ends_on, '[]') WITH &&
    )
);

-- Zadanie = rzecz, na którą logujemy czas (task z Jiry, konkretny MR do
-- review, sesja pair programmingu…). KAŻDE zadanie ma story pointy
-- (wartość ze skali): formularz podpowiada task_types.default_story_points.
-- Nowe zadanie trafia domyślnie do sprintu obejmującego dzisiejszą datę.
CREATE TABLE tasks (
    id                       uuid PRIMARY KEY,
    user_id                  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_type_id             uuid NOT NULL,
    status_id                uuid NOT NULL,
    project_id               uuid,
    sprint_id                uuid,
    parent_task_id           uuid,                   -- np. CR MR-a należącego do zadania X
    title                    text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
    description              text CHECK (char_length(description) <= 5000),
    external_url             text CHECK (external_url ~* '^https?://'),
    external_key             text CHECK (char_length(external_key) <= 40),  -- z URL: PAY-123, !482
    story_points             numeric(4,1) NOT NULL CHECK (story_points > 0 AND story_points <= 100),
    completed_at             timestamptz,            -- ustawiane przez serwis przy przejściu do statusu kategorii 'done'
    archived_at              timestamptz,
    created_at               timestamptz NOT NULL DEFAULT now(),
    updated_at               timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, user_id),
    CHECK (parent_task_id IS NULL OR parent_task_id <> id),
    FOREIGN KEY (task_type_id, user_id)   REFERENCES task_types (id, user_id),
    FOREIGN KEY (status_id, user_id)      REFERENCES task_statuses (id, user_id),
    FOREIGN KEY (project_id, user_id)     REFERENCES projects (id, user_id) ON DELETE SET NULL (project_id),
    FOREIGN KEY (sprint_id, user_id)      REFERENCES sprints (id, user_id)  ON DELETE SET NULL (sprint_id),
    FOREIGN KEY (parent_task_id, user_id) REFERENCES tasks (id, user_id)    ON DELETE SET NULL (parent_task_id)
);
CREATE INDEX ix_tasks_user_open      ON tasks (user_id, status_id) WHERE archived_at IS NULL;
CREATE INDEX ix_tasks_sprint         ON tasks (sprint_id) WHERE sprint_id IS NOT NULL;
CREATE INDEX ix_tasks_type           ON tasks (task_type_id);
CREATE INDEX ix_tasks_status         ON tasks (status_id);
CREATE INDEX ix_tasks_external_url   ON tasks (user_id, external_url) WHERE external_url IS NOT NULL; -- ten sam link → ten sam task
CREATE INDEX ix_tasks_title_trgm     ON tasks USING gin (title gin_trgm_ops);                        -- autocomplete w formularzu

CREATE TABLE tags (
    id       uuid PRIMARY KEY,
    user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name     text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 30),
    color    text NOT NULL DEFAULT '#64748B' CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
    UNIQUE (user_id, name),
    UNIQUE (id, user_id)
);

CREATE TABLE task_tags (
    task_id  uuid NOT NULL,
    tag_id   uuid NOT NULL,
    user_id  uuid NOT NULL,
    PRIMARY KEY (task_id, tag_id),
    FOREIGN KEY (task_id, user_id) REFERENCES tasks (id, user_id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id, user_id)  REFERENCES tags (id, user_id)  ON DELETE CASCADE
);
CREATE INDEX ix_task_tags_tag ON task_tags (tag_id);

-- Wpis czasu. Trzy dozwolone kształty (pilnuje tego CHECK):
--   1) zakres:       started_at + ended_at, duration = różnica
--   2) sam czas:     tylko duration_seconds (np. "CR, 25 min")
--   3) timer w toku: started_at, bez ended_at i bez duration
CREATE TABLE time_entries (
    id                uuid PRIMARY KEY,
    user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id           uuid NOT NULL,                 -- zadania archiwizujemy, nie kasujemy
    work_date         date NOT NULL,                 -- dzień w strefie użytkownika (oś analityki)
    started_at        timestamptz,
    ended_at          timestamptz,
    duration_seconds  integer CHECK (duration_seconds BETWEEN 1 AND 86400),
    note              text CHECK (char_length(note) <= 2000),
    source            time_entry_source NOT NULL DEFAULT 'manual',
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (task_id, user_id) REFERENCES tasks (id, user_id),
    CHECK (ended_at IS NULL OR started_at IS NOT NULL),
    CHECK (ended_at IS NULL OR ended_at > started_at),
    CHECK ((duration_seconds IS NULL) = (started_at IS NOT NULL AND ended_at IS NULL)),
    CHECK (ended_at IS NULL
           OR duration_seconds = extract(epoch FROM (ended_at - started_at))::integer)
);
CREATE INDEX ix_time_entries_user_date  ON time_entries (user_id, work_date);
CREATE INDEX ix_time_entries_task       ON time_entries (task_id);
CREATE UNIQUE INDEX ux_time_entries_one_running_timer
    ON time_entries (user_id) WHERE duration_seconds IS NULL;             -- max 1 aktywny timer

-- Szybkie szablony: jeden klik / skrót Alt+1…9 → wpis ("Daily 15 min").
CREATE TABLE quick_templates (
    id                        uuid PRIMARY KEY,
    user_id                   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_type_id              uuid NOT NULL,
    project_id                uuid,
    label                     text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 40),
    title                     text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
    story_points              numeric(4,1) CHECK (story_points BETWEEN 0 AND 100),  -- NULL = domyślne z typu
    default_duration_minutes  smallint CHECK (default_duration_minutes BETWEEN 1 AND 720),
    hotkey                    smallint CHECK (hotkey BETWEEN 1 AND 9),
    sort_order                smallint NOT NULL DEFAULT 0,
    created_at                timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, hotkey),
    FOREIGN KEY (task_type_id, user_id) REFERENCES task_types (id, user_id) ON DELETE CASCADE,
    FOREIGN KEY (project_id, user_id)   REFERENCES projects (id, user_id)   ON DELETE SET NULL (project_id)
);

-- =====================================================================
--  PŁATNOŚCI (Stripe) — per użytkownik. Plany: free / pro / lifetime.
--  Stripe jest źródłem prawdy; billing_accounts.plan to "efektywny plan",
--  aktualizowany wyłącznie przez webhooki.
-- =====================================================================
CREATE TABLE billing_accounts (
    user_id             uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    stripe_customer_id  text UNIQUE,
    plan                plan_code NOT NULL DEFAULT 'free',
    plan_valid_until    timestamptz,                 -- NULL = bezterminowo (free / lifetime)
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE subscriptions (                         -- Pro (miesięcznie lub rocznie)
    id                      uuid PRIMARY KEY,
    user_id                 uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_subscription_id  text NOT NULL UNIQUE,
    stripe_price_id         text NOT NULL,
    plan                    plan_code NOT NULL CHECK (plan = 'pro'),
    status                  subscription_status NOT NULL,
    current_period_end      timestamptz NOT NULL,
    cancel_at_period_end    boolean NOT NULL DEFAULT false,
    trial_ends_at           timestamptz,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_subscriptions_user ON subscriptions (user_id);

CREATE TABLE one_time_purchases (                    -- Lifetime (jednorazowa płatność)
    id                          uuid PRIMARY KEY,
    user_id                     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_checkout_session_id  text NOT NULL UNIQUE,
    stripe_payment_intent_id    text UNIQUE,
    plan                        plan_code NOT NULL CHECK (plan = 'lifetime'),
    amount_minor                integer NOT NULL CHECK (amount_minor > 0),  -- w groszach/centach
    currency                    char(3) NOT NULL,
    paid_at                     timestamptz NOT NULL,
    refunded_at                 timestamptz
);

CREATE TABLE stripe_webhook_events (                 -- idempotencja webhooków
    id            text PRIMARY KEY,                  -- evt_…
    type          text NOT NULL,
    payload       jsonb NOT NULL,
    received_at   timestamptz NOT NULL DEFAULT now(),
    processed_at  timestamptz,
    error         text
);

-- =====================================================================
--  AUDYT (zmiany ról, skali SP, planu, akcje managera/admina)
-- =====================================================================
CREATE TABLE audit_events (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_id        uuid REFERENCES users(id) ON DELETE SET NULL,   -- kto wykonał
    target_user_id  uuid REFERENCES users(id) ON DELETE CASCADE,    -- czyich danych dotyczy
    action          text NOT NULL,           -- 'user.role_changed', 'settings.sp_scale_changed'
    entity_type     text,
    entity_id       uuid,
    data            jsonb,
    occurred_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_audit_events_target ON audit_events (target_user_id, occurred_at DESC);

-- =====================================================================
--  WIDOKI ANALITYCZNE (KPI)
-- =====================================================================

-- Per zadanie: story pointy i rzeczywisty czas spędzony nad zadaniem.
CREATE VIEW v_task_time AS
SELECT t.id            AS task_id,
       t.user_id,
       t.sprint_id,
       t.project_id,
       t.task_type_id,
       t.title,
       t.archived_at,
       ts.category     AS status_category,
       t.story_points,
       COALESCE(SUM(te.duration_seconds), 0) AS total_seconds,
       COUNT(te.id)                          AS entries,
       MIN(te.work_date)                     AS first_work_date,
       MAX(te.work_date)                     AS last_work_date
FROM tasks t
JOIN task_statuses ts ON ts.id = t.status_id
LEFT JOIN time_entries te ON te.task_id = t.id AND te.duration_seconds IS NOT NULL
GROUP BY t.id, ts.category;

-- Per dzień i typ pracy (dashboard dnia, heatmapa, trend tygodniowy/miesięczny).
CREATE VIEW v_daily_summary AS
SELECT te.user_id,
       te.work_date,
       tt.id    AS task_type_id,
       tt.kind,
       tt.counts_as_focus_work,
       SUM(te.duration_seconds) AS total_seconds,
       COUNT(*)                 AS entries
FROM time_entries te
JOIN tasks t       ON t.id  = te.task_id
JOIN task_types tt ON tt.id = t.task_type_id
WHERE te.duration_seconds IS NOT NULL
GROUP BY te.user_id, te.work_date, tt.id;

-- Per sprint i typ pracy — tu sumują się SP także z Code Review itd.:
--   planned_sp     — SP wszystkich zadań przypisanych do sprintu
--   done_sp        — SP zadań w statusie kategorii 'done'
--   total_seconds  — rzeczywisty czas zalogowany w dniach sprintu
-- Suma po wszystkich typach = wynik całego sprintu.
CREATE VIEW v_sprint_summary AS
WITH sp AS (
    SELECT t.sprint_id,
           t.task_type_id,
           SUM(t.story_points)                                      AS planned_sp,
           SUM(t.story_points) FILTER (WHERE ts.category = 'done')  AS done_sp,
           COUNT(*)                                                 AS tasks_total,
           COUNT(*) FILTER (WHERE ts.category = 'done')             AS tasks_done
    FROM tasks t
    JOIN task_statuses ts ON ts.id = t.status_id
    WHERE t.sprint_id IS NOT NULL AND t.archived_at IS NULL
    GROUP BY t.sprint_id, t.task_type_id
), tm AS (
    SELECT s.id AS sprint_id,
           t.task_type_id,
           SUM(te.duration_seconds) AS total_seconds
    FROM sprints s
    JOIN time_entries te ON te.user_id = s.user_id
                        AND te.work_date BETWEEN s.starts_on AND s.ends_on
                        AND te.duration_seconds IS NOT NULL
    JOIN tasks t ON t.id = te.task_id
    GROUP BY s.id, t.task_type_id
)
SELECT s.id                           AS sprint_id,
       s.user_id,
       s.name                         AS sprint_name,
       s.starts_on,
       s.ends_on,
       tt.id                          AS task_type_id,
       tt.name                        AS task_type_name,
       tt.kind,
       COALESCE(sp.planned_sp, 0)     AS planned_sp,
       COALESCE(sp.done_sp, 0)        AS done_sp,
       COALESCE(sp.tasks_total, 0)    AS tasks_total,
       COALESCE(sp.tasks_done, 0)     AS tasks_done,
       COALESCE(tm.total_seconds, 0)  AS total_seconds
FROM sprints s
JOIN task_types tt ON tt.user_id = s.user_id
LEFT JOIN sp ON sp.sprint_id = s.id AND sp.task_type_id = tt.id
LEFT JOIN tm ON tm.sprint_id = s.id AND tm.task_type_id = tt.id
WHERE sp.sprint_id IS NOT NULL OR tm.sprint_id IS NOT NULL;
