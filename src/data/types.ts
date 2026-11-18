/**
 * Typy domenowe — 1:1 ze schematem bazy (docs/database/schema.sql) i kontraktem API.
 * Daty dzienne jako 'YYYY-MM-DD', znaczniki czasu jako ISO 8601.
 */
import type { WorkKind } from '#/config/work-types'
import type { Locale } from '#/i18n/config'

export type UserRole = 'client' | 'manager' | 'admin'
export type PlanCode = 'free' | 'pro' | 'lifetime'
export type FieldRequirement = 'hidden' | 'optional' | 'required'
export type TimeInputMode = 'range' | 'duration'
export type StatusCategory = 'todo' | 'in_progress' | 'done'
export type RoundingMinutes = 0 | 1 | 5 | 10 | 15 | 30

export type User = {
  id: string
  username: string
  email: string
  displayName: string
  role: UserRole
  plan: PlanCode
  /** false = konto założone przez Google, bez hasła. */
  hasPassword: boolean
  /** Konto demo z przykładowymi danymi (bez zakupów i zmian konta, usuwane po 24 h). */
  isDemo: boolean
}

export type AuthSession = { accessToken: string; expiresAt: string; user: User }

/** Rodzaj dnia wolnego: urlop, zwolnienie lekarskie (L4), święto, inne wolne. */
export type DayOffKind = 'vacation' | 'sick' | 'holiday' | 'other'
export const DAY_OFF_KINDS: ReadonlyArray<DayOffKind> = [
  'vacation',
  'sick',
  'holiday',
  'other',
]
export type DayOff = {
  date: string
  kind: DayOffKind
  note: string | null
}
/** Zakres dni wolnych: dni pracy z ustawień w tym zakresie dostają ten sam rodzaj. */
export type DayOffInput = {
  from: string
  to: string
  kind: DayOffKind
  note: string | null
}

export type UserSettings = {
  workdayTargetMinutes: number
  /** 0 = niedziela … 6 = sobota (jak .NET DayOfWeek). */
  workingDays: Array<number>
  weekStartsOn: number
  timeRoundingMinutes: RoundingMinutes
  timezone: string
  locale: Locale
  /** 'HH:MM' albo null = przypomnienie wyłączone. */
  dailyReminderAt: string | null
  /** Własny szablon podsumowania zadania; null = domyślny w języku użytkownika. */
  summaryTemplate: string | null
  /** Ile minut przerwy dziennie przysługuje; 0 = bez limitu. */
  breakMinutes: number
}

/** Przerwa w pracy: nie jest czasem pracy, liczy się względem dziennego limitu. */
export type WorkBreak = {
  id: string
  workDate: string
  startTime: string | null
  endTime: string | null
  durationMinutes: number
  running: boolean
  startedAt: string | null
  /** Zadanie wstrzymane na czas przerwy. */
  resumeEntryId: string | null
}
export type WorkBreakInput = {
  workDate: string
  startTime: string | null
  endTime: string | null
  durationMinutes: number
}

export type SpScaleStep = { id: string; points: number; maxMinutes: number }

export type TaskType = {
  id: string
  kind: WorkKind
  name: string
  color: string
  isSystem: boolean
  titleLabel: string
  linkRequirement: FieldRequirement
  linkLabel: string
  descriptionRequirement: FieldRequirement
  /** Czy wpis tego typu ma story pointy: wymagane (zadania), opcjonalne (CR, pair) albo wcale (spotkania). */
  storyPointsRequirement: FieldRequirement
  /** Wartość zaznaczona w formularzu; null = domyślnie bez SP (tylko gdy SP nie są wymagane). */
  defaultStoryPoints: number | null
  defaultTimeInput: TimeInputMode
  countsAsFocusWork: boolean
  sortOrder: number
  archivedAt: string | null
}

export type TaskStatus = {
  id: string
  name: string
  category: StatusCategory
  color: string
  isSystem: boolean
  isDefault: boolean
  sortOrder: number
  archivedAt: string | null
}

export type SprintCadence = {
  lengthDays: number
  anchorDate: string
  namePattern: string
  autoCreate: boolean
}

export type Sprint = {
  id: string
  number: number | null
  name: string
  goal: string | null
  startsOn: string
  endsOn: string
  capacityStoryPoints: number | null
  fromCadence: boolean
}

export type Project = {
  id: string
  name: string
  key: string | null
  color: string
  archivedAt: string | null
}

export type Tag = { id: string; name: string; color: string }

export type QuickTemplate = {
  id: string
  taskTypeId: string
  projectId: string | null
  /** Dowolny projekt: przy użyciu szablonu aplikacja pyta, do którego projektu zapisać. */
  askProject: boolean
  label: string
  title: string
  storyPoints: number | null
  defaultDurationMinutes: number | null
  hotkey: number | null
  sortOrder: number
}

/**
 * Wpis czasu. Tytuł, link i SP opisują zadanie (w API: tabela tasks, wpis wskazuje task_id),
 * a notatka należy do wpisu: co konkretnie zostało zrobione w tym czasie.
 */
export type TimeEntry = {
  id: string
  taskTypeId: string
  projectId: string | null
  title: string
  link: string | null
  /** null = wpis bez SP (dozwolone, gdy typ ma SP opcjonalne albo ukryte). */
  storyPoints: number | null
  /** Dzień w strefie użytkownika (YYYY-MM-DD). */
  workDate: string
  /** 'HH:MM' albo null, gdy wpis podano jako sam czas trwania. */
  startTime: string | null
  endTime: string | null
  /** Dla działającego timera 0 — czas liczy się od `startedAt`. */
  durationMinutes: number
  note: string | null
  /**
   * Nadgodziny: ile minut z `durationMinutes` przypada po godzinach (null = brak).
   * Zawsze razem z opisem, co wtedy było robione. Tylko dla zakończonych wpisów.
   */
  overtimeMinutes: number | null
  overtimeNote: string | null
  /**
   * Estymata całego zadania w minutach, podana przed pracą (null = brak). Jak SP należy do
   * zadania: raport porównuje ją z łącznym czasem wszystkich sesji.
   */
  estimateMinutes: number | null
  /**
   * Przedłużenie: ile minut z `durationMinutes` wyszło ponad plan (np. spotkanie na 1 h trwało
   * 1 h 20 min) i dlaczego. Zawsze razem z powodem; tylko dla zakończonych wpisów.
   */
  extensionMinutes: number | null
  extensionNote: string | null
  /** Kiedy zadanie oznaczono jako zakończone (ISO); null = w toku. */
  finishedAt: string | null
  /** Timer działa: jest start, nie ma końca. Najwyżej jeden naraz. */
  running: boolean
  /** Sesja przerwana (przełączenie na inne zadanie albo „Wstrzymaj”): zadanie czeka na „Wznów”. */
  paused: boolean
  /** Dokładny moment startu (ISO), tylko dla wpisów z timera. */
  startedAt: string | null
  createdAt: string
}

// ---------- Dane wejściowe (create/update) ----------

export type TaskTypeInput = Omit<
  TaskType,
  'id' | 'kind' | 'isSystem' | 'sortOrder' | 'archivedAt'
>
export type TaskStatusInput = Pick<TaskStatus, 'name' | 'category' | 'color'>
export type SprintInput = Pick<
  Sprint,
  'name' | 'goal' | 'startsOn' | 'endsOn' | 'capacityStoryPoints'
>
export type ProjectInput = Pick<Project, 'name' | 'key' | 'color'>
export type TagInput = Pick<Tag, 'name' | 'color'>
export type QuickTemplateInput = Omit<QuickTemplate, 'id' | 'sortOrder'>
export type TimeEntryInput = Omit<
  TimeEntry,
  'id' | 'createdAt' | 'startedAt' | 'paused' | 'finishedAt'
>
/** Start timera: wszystko jak we wpisie, ale tylko godzina startu (domyślnie „teraz”). */
export type TimerStartInput = Omit<
  TimeEntryInput,
  | 'endTime'
  | 'durationMinutes'
  | 'running'
  | 'startTime'
  | 'overtimeMinutes'
  | 'overtimeNote'
  | 'extensionMinutes'
  | 'extensionNote'
  | 'estimateMinutes'
> & { startTime: string; estimateMinutes?: number | null }
export type TaskRef = Pick<TimeEntry, 'title' | 'link' | 'taskTypeId'>
/** Zmiana zadania we wszystkich jego wpisach. */
export type TaskUpdateInput = Pick<
  TimeEntry,
  'title' | 'link' | 'projectId' | 'storyPoints'
> & { estimateMinutes?: number | null }
export type TimerStartResult = { started: TimeEntry; stopped: TimeEntry | null }

/** Zadanie z poprzednich dni, którego nie zakończono (lista „Do dokończenia”). */
export type UnfinishedTask = {
  /** Najświeższa sesja zadania (z niej „Kontynuuj” startuje nową sesję). */
  entry: TimeEntry
  /** Cały przepracowany czas zadania (wszystkie sesje). */
  workedMinutes: number
  sessions: number
  /** Ostatni dzień pracy nad zadaniem (YYYY-MM-DD). */
  lastDate: string
}
export type ProfileInput = Pick<User, 'displayName' | 'email'>
export type PasswordChangeInput = {
  currentPassword: string
  newPassword: string
}

export type RegisterInput = {
  username: string
  email: string
  password: string
  locale: Locale
  /** Strefa IANA przeglądarki: od niej zależy „dziś” i sprinty. */
  timezone?: string
}
export type LoginInput = { login: string; password: string }

/** Stan płatności konta (GET /billing). Wszystkie płatne plany są roczne, płatne z góry. */
export type BillingStatus = {
  /** false = serwer nie ma klucza Stripe; zakup jest wyłączony. */
  enabled: boolean
  plan: PlanCode
  subscription: {
    status: string
    plan: PlanCode
    active: boolean
    /** Koniec opłaconego roku (odnowienie albo koniec planu). */
    currentPeriodEnd: string | null
    cancelAtPeriodEnd: boolean
  } | null
}

/** Start panelu jednym żądaniem (GET /bootstrap): konto, konfiguracja i dzisiejszy dzień. */
export type Bootstrap = {
  user: User
  settings: UserSettings
  taskTypes: Array<TaskType>
  scale: Array<SpScaleStep>
  projects: Array<Project>
  templates: Array<QuickTemplate>
  /** „Dziś” w strefie użytkownika (YYYY-MM-DD). */
  today: string
  entries: Array<TimeEntry>
  paused: Array<TimeEntry>
  running: TimeEntry | null
}

// ---------- Panel administratora ----------

export type AdminUser = {
  id: string
  username: string
  email: string
  displayName: string
  role: UserRole
  plan: PlanCode
  isDemo: boolean
  hasPassword: boolean
  emailVerified: boolean
  /** Właściciel aplikacji (ADMIN_EMAILS): nie da się go zablokować, usunąć ani zdegradować. */
  isOwner: boolean
  /** Data blokady konta albo null. */
  disabledAt: string | null
  createdAt: string
  lastLoginAt: string | null
  /** Liczba wpisów czasu (treści wpisów administrator nie widzi). */
  entries: number
  lastEntryOn: string | null
  subscription: {
    status: string
    active: boolean
    currentPeriodEnd: string | null
    cancelAtPeriodEnd: boolean
  } | null
}

export type AdminUserFilter = {
  q?: string
  plan?: PlanCode
  status?: 'active' | 'blocked' | 'demo'
  page?: number
}

export type AdminUserPage = {
  items: Array<AdminUser>
  total: number
  page: number
  pageSize: number
}

export type AdminUserChange = {
  plan?: PlanCode
  role?: 'client' | 'admin'
  disabled?: boolean
}

export type AdminStats = {
  users: number
  new7: number
  new30: number
  active7: number
  free: number
  pro: number
  lifetime: number
  blocked: number
  demo: number
  activeSubscriptions: number
  /** Roczny przychód z aktywnych subskrypcji (USD). */
  yearlyRevenue: number
  /** Rejestracje z ostatnich 14 dni (tylko dni z rejestracjami). */
  signups: Array<{ day: string; count: number }>
}

export type AdminAction = {
  id: string
  adminEmail: string
  targetEmail: string
  action: string
  detail: string | null
  createdAt: string
}
