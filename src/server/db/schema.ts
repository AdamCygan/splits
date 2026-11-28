/**
 * Schemat bazy (PostgreSQL 16+). Model per użytkownik: każdy rekord domenowy ma user_id.
 * Migracje SQL generuje drizzle-kit (`pnpm db:generate`) do katalogu drizzle/.
 * Reguły (długości, formaty) są też w src/domain/* i walidacji API.
 */
import { sql } from 'drizzle-orm'
import type { SprintTimeGoal } from '#/features/sprints/data/dto'
import type { TemplateSchedule } from '#/features/templates/data/dto'
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

const id = () => uuid('id').primaryKey().defaultRandom()
const userId = () =>
  uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date())
/** SP i podobne wartości: numeric(4,1) zwracany jako liczba (0.5, 13). */
const points = (name: string) =>
  numeric(name, { precision: 4, scale: 1, mode: 'number' })

export const userRole = pgEnum('user_role', ['client', 'manager', 'admin'])
export const planCode = pgEnum('plan_code', ['free', 'pro', 'lifetime'])
export const authTokenPurpose = pgEnum('auth_token_purpose', [
  'email_verification',
  'password_reset',
  'email_change',
  'account_deletion',
])
export const taskKind = pgEnum('task_kind', [
  'task',
  'code_review',
  'pair_programming',
  'additional_work',
  'meeting',
  'custom',
])
export const fieldRequirement = pgEnum('field_requirement', [
  'hidden',
  'optional',
  'required',
])
export const timeInputMode = pgEnum('time_input_mode', ['range', 'duration'])
export const statusCategory = pgEnum('status_category', [
  'todo',
  'in_progress',
  'done',
])

// ---------------------------------------------------------------------------
// Użytkownicy i logowanie
// ---------------------------------------------------------------------------

export const users = pgTable(
  'users',
  {
    id: id(),
    username: text('username').notNull(),
    email: text('email').notNull(),
    /** scrypt; null = konto tylko z Google. */
    passwordHash: text('password_hash'),
    role: userRole('role').notNull().default('client'),
    plan: planCode('plan').notNull().default('free'),
    displayName: text('display_name').notNull(),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    failedLoginCount: smallint('failed_login_count').notNull().default(0),
    lockoutUntil: timestamp('lockout_until', { withTimezone: true }),
    passwordChangedAt: timestamp('password_changed_at', { withTimezone: true }),
    /** Sekret TOTP (2FA), zaszyfrowany AES-GCM kluczem z JWT_SECRET; null = 2FA wyłączone. */
    totpSecret: text('totp_secret'),
    totpEnabledAt: timestamp('totp_enabled_at', { withTimezone: true }),
    /** Ostatni użyty krok czasu TOTP: ten sam kod nie zadziała drugi raz. */
    totpLastStep: integer('totp_last_step'),
    /** Skróty SHA-256 jednorazowych kodów zapasowych 2FA. */
    recoveryCodes: jsonb('recovery_codes')
      .$type<Array<string>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    /** Klient w Stripe (cus_…), tworzony przy pierwszym przejściu do płatności. */
    stripeCustomerId: text('stripe_customer_id').unique(),
    /** Konto demo (przycisk „Zobacz demo”): przykładowe dane, bez zakupów, usuwane po 24 h. */
    isDemo: boolean('is_demo').notNull().default(false),
    /** Zablokowane przez administratora: logowanie i odświeżanie sesji są odrzucane. */
    disabledAt: timestamp('disabled_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('users_created_idx').on(t.createdAt),
    index('users_demo_idx')
      .on(t.createdAt)
      .where(sql`${t.isDemo}`),
    uniqueIndex('users_username_key').on(sql`lower(${t.username})`),
    uniqueIndex('users_email_key').on(sql`lower(${t.email})`),
    check(
      'users_display_name_len',
      sql`char_length(${t.displayName}) between 1 and 80`,
    ),
  ],
)

export const externalLogins = pgTable(
  'external_logins',
  {
    provider: text('provider').notNull(),
    /** "sub" z Google. */
    providerUserId: text('provider_user_id').notNull(),
    userId: userId(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.provider, t.providerUserId] }),
    index('external_logins_user_idx').on(t.userId),
  ],
)

/**
 * Refresh tokeny z rotacją: trzymamy tylko hash SHA-256. Ponowne użycie unieważnionego
 * tokenu unieważnia całą rodzinę (ktoś skopiował ciasteczko).
 */
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: id(),
    userId: userId(),
    familyId: uuid('family_id').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    userAgent: text('user_agent'),
    ip: text('ip'),
    createdAt: createdAt(),
  },
  (t) => [index('refresh_tokens_user_idx').on(t.userId)],
)

export const authTokens = pgTable('auth_tokens', {
  id: id(),
  userId: userId(),
  purpose: authTokenPurpose('purpose').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  /** Nowy adres przy zmianie e-maila (purpose = email_change). */
  newEmail: text('new_email'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: createdAt(),
})

export const userSettings = pgTable(
  'user_settings',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    workdayTargetMinutes: smallint('workday_target_minutes')
      .notNull()
      .default(480),
    /** 0 = niedziela … 6 = sobota. */
    workingDays: smallint('working_days')
      .array()
      .notNull()
      .default(sql`'{1,2,3,4,5}'`),
    weekStartsOn: smallint('week_starts_on').notNull().default(1),
    timeRoundingMinutes: smallint('time_rounding_minutes').notNull().default(0),
    timezone: text('timezone').notNull().default('UTC'),
    locale: text('locale').notNull().default('en'),
    /** 'HH:MM' albo null = przypomnienie wyłączone. */
    dailyReminderAt: text('daily_reminder_at'),
    /** Dzień (lokalny), w którym poszło ostatnie przypomnienie: najwyżej jedno dziennie. */
    reminderSentOn: date('reminder_sent_on'),
    summaryTemplate: text('summary_template'),
    /** Ile minut przerwy dziennie przysługuje (0 = bez limitu na przerwy). */
    breakMinutes: smallint('break_minutes').notNull().default(30),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('user_settings_break', sql`${t.breakMinutes} between 0 and 240`),
    check(
      'user_settings_target',
      sql`${t.workdayTargetMinutes} between 0 and 1440`,
    ),
    check('user_settings_week_start', sql`${t.weekStartsOn} between 0 and 6`),
    check(
      'user_settings_rounding',
      sql`${t.timeRoundingMinutes} in (0, 1, 5, 10, 15, 30)`,
    ),
  ],
)

// ---------------------------------------------------------------------------
// Konfiguracja pracy
// ---------------------------------------------------------------------------

export const storyPointScale = pgTable(
  'story_point_scale',
  {
    id: id(),
    userId: userId(),
    points: points('points').notNull(),
    maxMinutes: integer('max_minutes').notNull(),
  },
  (t) => [
    uniqueIndex('story_point_scale_points_key').on(t.userId, t.points),
    check(
      'story_point_scale_range',
      sql`${t.points} > 0 and ${t.points} <= 100 and ${t.maxMinutes} between 1 and 100000`,
    ),
  ],
)

export const taskTypes = pgTable(
  'task_types',
  {
    id: id(),
    userId: userId(),
    kind: taskKind('kind').notNull(),
    name: text('name').notNull(),
    color: text('color').notNull(),
    isSystem: boolean('is_system').notNull().default(false),
    titleLabel: text('title_label').notNull(),
    linkRequirement: fieldRequirement('link_requirement')
      .notNull()
      .default('optional'),
    linkLabel: text('link_label').notNull().default('Link'),
    descriptionRequirement: fieldRequirement('description_requirement')
      .notNull()
      .default('optional'),
    storyPointsRequirement: fieldRequirement('story_points_requirement')
      .notNull()
      .default('optional'),
    defaultStoryPoints: points('default_story_points'),
    defaultTimeInput: timeInputMode('default_time_input')
      .notNull()
      .default('duration'),
    countsAsFocusWork: boolean('counts_as_focus_work').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('task_types_name_key').on(t.userId, sql`lower(${t.name})`),
    check(
      'task_types_sp_default',
      sql`(${t.storyPointsRequirement} <> 'hidden' or ${t.defaultStoryPoints} is null)
        and (${t.storyPointsRequirement} <> 'required' or ${t.defaultStoryPoints} is not null)`,
    ),
  ],
)

export const taskStatuses = pgTable(
  'task_statuses',
  {
    id: id(),
    userId: userId(),
    name: text('name').notNull(),
    category: statusCategory('category').notNull(),
    color: text('color').notNull(),
    isSystem: boolean('is_system').notNull().default(false),
    isDefault: boolean('is_default').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('task_statuses_name_key').on(t.userId, sql`lower(${t.name})`),
    // Najwyżej jeden status domyślny na użytkownika.
    uniqueIndex('task_statuses_default_key')
      .on(t.userId)
      .where(sql`${t.isDefault}`),
  ],
)

export const sprintCadences = pgTable('sprint_cadences', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  lengthDays: smallint('length_days').notNull(),
  anchorDate: date('anchor_date', { mode: 'string' }).notNull(),
  namePattern: text('name_pattern').notNull(),
  autoCreate: boolean('auto_create').notNull().default(true),
})

export const sprints = pgTable(
  'sprints',
  {
    id: id(),
    userId: userId(),
    number: integer('number'),
    name: text('name').notNull(),
    goal: text('goal'),
    startsOn: date('starts_on', { mode: 'string' }).notNull(),
    endsOn: date('ends_on', { mode: 'string' }).notNull(),
    capacityStoryPoints: points('capacity_story_points'),
    fromCadence: boolean('from_cadence').notNull().default(false),
    /** Cele czasowe na rodzaje pracy: [{ taskTypeId, minutes }]. */
    timeGoals: jsonb('time_goals')
      .$type<Array<SprintTimeGoal>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
  },
  (t) => [
    index('sprints_user_start_idx').on(t.userId, t.startsOn),
    check('sprints_dates', sql`${t.endsOn} >= ${t.startsOn}`),
  ],
)

/**
 * Przerwa w pracy (kawa, obiad). Nie jest czasem pracy, więc nie trafia do wpisów ani raportów
 * zadań; liczy się względem dziennego limitu z ustawień. Najwyżej jedna trwająca przerwa naraz.
 */
export const breaks = pgTable(
  'breaks',
  {
    id: id(),
    userId: userId(),
    workDate: date('work_date', { mode: 'string' }).notNull(),
    /** 'HH:MM'; null = przerwa dopisana tylko jako czas trwania. */
    startTime: text('start_time'),
    endTime: text('end_time'),
    /** 0, dopóki przerwa trwa. */
    durationMinutes: smallint('duration_minutes').notNull().default(0),
    running: boolean('running').notNull().default(false),
    startedAt: timestamp('started_at', { withTimezone: true }),
    /** Zadanie wstrzymane na czas przerwy; „Koniec przerwy” może je wznowić. */
    resumeEntryId: uuid('resume_entry_id').references(() => timeEntries.id, {
      onDelete: 'set null',
    }),
    createdAt: createdAt(),
  },
  (t) => [
    index('breaks_user_date').on(t.userId, t.workDate),
    uniqueIndex('breaks_one_running')
      .on(t.userId)
      .where(sql`${t.running}`),
    check(
      'breaks_duration',
      sql`${t.durationMinutes} between 0 and 1440
        and (${t.running} or ${t.durationMinutes} >= 1)`,
    ),
  ],
)

/**
 * Dzień wolny: urlop, zwolnienie lekarskie, święto albo inne wolne. Jeden wiersz na dzień
 * (zakres urlopu to kilka wierszy), dzięki temu sprint liczy dostępne dni prostym zapytaniem.
 */
export const daysOff = pgTable(
  'days_off',
  {
    id: id(),
    userId: userId(),
    date: date('date', { mode: 'string' }).notNull(),
    kind: text('kind').notNull(),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('days_off_user_date').on(t.userId, t.date),
    check(
      'days_off_kind',
      sql`${t.kind} in ('vacation', 'sick', 'holiday', 'other')`,
    ),
    check(
      'days_off_note',
      sql`${t.note} is null or char_length(${t.note}) between 1 and 200`,
    ),
  ],
)

export const projects = pgTable(
  'projects',
  {
    id: id(),
    userId: userId(),
    name: text('name').notNull(),
    key: text('key'),
    color: text('color').notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('projects_name_key').on(t.userId, sql`lower(${t.name})`),
    uniqueIndex('projects_key_key')
      .on(t.userId, t.key)
      .where(sql`${t.key} is not null`),
  ],
)

export const tags = pgTable(
  'tags',
  {
    id: id(),
    userId: userId(),
    name: text('name').notNull(),
    color: text('color').notNull(),
  },
  (t) => [uniqueIndex('tags_name_key').on(t.userId, sql`lower(${t.name})`)],
)

// ---------------------------------------------------------------------------
// Czas pracy
// ---------------------------------------------------------------------------

/**
 * Wpis czasu. Tytuł, link i SP opisują zadanie (wpisy z tym samym linkiem albo tym samym
 * typem i tytułem to jedno zadanie), a notatka należy do sesji.
 */
export const timeEntries = pgTable(
  'time_entries',
  {
    id: id(),
    userId: userId(),
    taskTypeId: uuid('task_type_id')
      .notNull()
      .references(() => taskTypes.id),
    projectId: uuid('project_id').references(() => projects.id, {
      onDelete: 'set null',
    }),
    title: text('title').notNull(),
    link: text('link'),
    storyPoints: points('story_points'),
    workDate: date('work_date', { mode: 'string' }).notNull(),
    /** 'HH:MM' albo null, gdy wpis to sam czas trwania. */
    startTime: text('start_time'),
    endTime: text('end_time'),
    durationMinutes: integer('duration_minutes').notNull(),
    note: text('note'),
    /**
     * Nadgodziny: ile minut z czasu wpisu to praca po godzinach (część durationMinutes, nie dodatek)
     * i co wtedy było robione. Oba pola razem albo żadne; tylko dla zakończonych wpisów.
     */
    overtimeMinutes: integer('overtime_minutes'),
    overtimeNote: text('overtime_note'),
    /** Estymata całego zadania przed pracą (minuty); jak SP należy do zadania, null = brak. */
    estimateMinutes: integer('estimate_minutes'),
    /**
     * Przedłużenie (np. spotkanie zaplanowane na 1 h trwało 1 h 20 min): ile minut z czasu wpisu
     * to dogrywka ponad plan i dlaczego. Część durationMinutes; oba pola razem albo żadne.
     */
    extensionMinutes: integer('extension_minutes'),
    extensionNote: text('extension_note'),
    /**
     * Kiedy zadanie oznaczono jako zakończone (wszystkie jego sesje dostają tę samą datę);
     * null = w toku. Nowa sesja zadania otwiera je z powrotem.
     */
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    running: boolean('running').notNull().default(false),
    /**
     * Wstrzymane: timer przerwany przełączeniem na inne zadanie albo przyciskiem „Wstrzymaj”.
     * Takie zadanie czeka na pasku z przyciskiem „Wznów” (nowa sesja = nowy odcinek czasu).
     */
    paused: boolean('paused').notNull().default(false),
    startedAt: timestamp('started_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('time_entries_user_date_idx').on(t.userId, t.workDate),
    index('time_entries_user_link_idx').on(t.userId, t.link),
    index('time_entries_user_paused_idx')
      .on(t.userId, t.workDate)
      .where(sql`${t.paused}`),
    // Najwyżej jeden działający timer na użytkownika.
    uniqueIndex('time_entries_running_key')
      .on(t.userId)
      .where(sql`${t.running}`),
    check(
      'time_entries_limits',
      sql`char_length(${t.title}) between 1 and 200
        and (${t.link} is null or char_length(${t.link}) <= 2048)
        and (${t.note} is null or char_length(${t.note}) <= 20000)
        and ${t.durationMinutes} between 0 and 1440`,
    ),
    check(
      'time_entries_overtime',
      sql`(${t.overtimeMinutes} is null and ${t.overtimeNote} is null)
        or (${t.overtimeMinutes} between 1 and ${t.durationMinutes}
          and not ${t.running}
          and char_length(${t.overtimeNote}) between 1 and 1000)`,
    ),
    check(
      'time_entries_estimate',
      sql`${t.estimateMinutes} is null or ${t.estimateMinutes} between 1 and 60000`,
    ),
    check(
      'time_entries_extension',
      sql`(${t.extensionMinutes} is null and ${t.extensionNote} is null)
        or (${t.extensionMinutes} between 1 and ${t.durationMinutes}
          and not ${t.running}
          and char_length(${t.extensionNote}) between 1 and 1000)`,
    ),
  ],
)

export const quickTemplates = pgTable(
  'quick_templates',
  {
    id: id(),
    userId: userId(),
    taskTypeId: uuid('task_type_id')
      .notNull()
      .references(() => taskTypes.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, {
      onDelete: 'set null',
    }),
    /** Dowolny projekt: wybierany przy każdym użyciu szablonu (projectId jest wtedy pusty). */
    askProject: boolean('ask_project').notNull().default(false),
    label: text('label').notNull(),
    title: text('title').notNull(),
    storyPoints: points('story_points'),
    defaultDurationMinutes: integer('default_duration_minutes'),
    hotkey: smallint('hotkey'),
    sortOrder: integer('sort_order').notNull().default(0),
    /** Powtarzanie: [{ day: 0–6, time: 'HH:MM' }]; pusta lista = bez harmonogramu. */
    schedule: jsonb('schedule')
      .$type<TemplateSchedule>()
      .notNull()
      .default(sql`'[]'::jsonb`),
  },
  (t) => [
    uniqueIndex('quick_templates_hotkey_key')
      .on(t.userId, t.hotkey)
      .where(sql`${t.hotkey} is not null`),
  ],
)

// ---------------------------------------------------------------------------
// Płatności (Stripe). Źródłem prawdy jest Stripe; tabela to kopia z webhooków.
// ---------------------------------------------------------------------------

export const subscriptions = pgTable(
  'subscriptions',
  {
    /** Id subskrypcji w Stripe (sub_…). */
    id: text('id').primaryKey(),
    userId: userId(),
    stripeCustomerId: text('stripe_customer_id').notNull(),
    /** Status ze Stripe: active, past_due, canceled, incomplete, unpaid… */
    status: text('status').notNull(),
    /** Plan wynikający z ceny (lookup key), np. pro. */
    plan: planCode('plan').notNull(),
    priceId: text('price_id').notNull(),
    /** Płatność co miesiąc albo co rok (z ceny); null dla subskrypcji sprzed tej kolumny. */
    interval: text('billing_interval', { enum: ['month', 'year'] }),
    quantity: integer('quantity').notNull().default(1),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('subscriptions_user_idx').on(t.userId)],
)

/** Przetworzone zdarzenia webhooków: każde obsługujemy dokładnie raz. */
export const stripeEvents = pgTable('stripe_events', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// ---------------------------------------------------------------------------
// Panel administratora
// ---------------------------------------------------------------------------

/**
 * Dziennik działań administratora (kto, co, na czyim koncie). Wpis zostaje po usunięciu konta,
 * dlatego obok id trzymamy też e-maile z chwili działania.
 */
export const adminActions = pgTable(
  'admin_actions',
  {
    id: id(),
    adminId: uuid('admin_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    adminEmail: text('admin_email').notNull(),
    targetUserId: uuid('target_user_id'),
    /** Konto, którego dotyczy akcja; null przy akcjach na wielu kontach (np. eksport listy). */
    targetEmail: text('target_email'),
    /** Rodzaj akcji, np. plan.changed, user.blocked, two_factor.disabled (lista w adminActionKinds). */
    action: text('action').notNull(),
    detail: text('detail'),
    createdAt: createdAt(),
  },
  (t) => [
    index('admin_actions_created_idx').on(t.createdAt),
    index('admin_actions_target_idx').on(t.targetUserId),
  ],
)

/**
 * Wpłaty ze Stripe (obciążenia kart) z webhooków charge.succeeded i charge.refunded.
 * Przychód w panelu admina liczymy z faktycznie zapłaconych kwot minus zwroty,
 * więc uwzględnia rabaty, podatki i zwroty. Kwoty w najmniejszej jednostce waluty.
 */
export const payments = pgTable(
  'payments',
  {
    /** Id obciążenia w Stripe (ch_…). */
    id: text('id').primaryKey(),
    /** Konto płacącego; po usunięciu konta wpłata zostaje w statystykach. */
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    stripeCustomerId: text('stripe_customer_id'),
    amount: integer('amount').notNull(),
    amountRefunded: integer('amount_refunded').notNull().default(0),
    currency: text('currency').notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('payments_paid_idx').on(t.paidAt)],
)

/**
 * Zgłoszenia z aplikacji („Zgłoś problem / pomysł”). Treść pisze użytkownik; strona i przeglądarka
 * pomagają odtworzyć błąd. Odpowiedź administratora widzi użytkownik (i dostaje ją mailem),
 * notatka wewnętrzna jest tylko dla adminów.
 */
export const feedback = pgTable(
  'feedback',
  {
    id: id(),
    userId: userId(),
    kind: text('kind').notNull(),
    message: text('message').notNull(),
    page: text('page'),
    userAgent: text('user_agent'),
    status: text('status').notNull().default('new'),
    reply: text('reply'),
    note: text('note'),
    repliedAt: timestamp('replied_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('feedback_status_created_idx').on(t.status, t.createdAt),
    index('feedback_user_idx').on(t.userId, t.createdAt),
    check('feedback_kind', sql`${t.kind} in ('bug', 'idea', 'question')`),
    check(
      'feedback_status',
      sql`${t.status} in ('new', 'in_progress', 'done', 'dismissed')`,
    ),
    check(
      'feedback_message',
      sql`char_length(${t.message}) between 5 and 4000`,
    ),
    check(
      'feedback_reply',
      sql`${t.reply} is null or char_length(${t.reply}) between 1 and 4000`,
    ),
  ],
)
