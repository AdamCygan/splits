import type { ApiFailure } from '#/lib/api-client'
import type { Result } from '#/lib/result'
import type {
  AuthSession,
  LoginInput,
  PasswordChangeInput,
  ProfileInput,
  Project,
  ProjectInput,
  QuickTemplate,
  QuickTemplateInput,
  RegisterInput,
  SpScaleStep,
  Sprint,
  SprintCadence,
  SprintInput,
  Tag,
  TagInput,
  TaskStatus,
  TaskStatusInput,
  TaskType,
  TaskTypeInput,
  TimeEntry,
  TimeEntryInput,
  TimerStartInput,
  TimerStartResult,
  TaskRef,
  User,
  UserSettings,
  BillingStatus,
  PlanCode,
  AdminAction,
  AdminStats,
  AdminUser,
  AdminUserChange,
  AdminUserFilter,
  AdminUserPage,
  Bootstrap,
} from './types'
import type { Locale } from '#/i18n/config'

export type R<T> = Promise<Result<ApiFailure, T>>

/**
 * Kontrakt warstwy danych. Implementacja: http (API z src/server pod /api/v1).
 * UI zna wyłącznie ten interfejs, więc testy mogą podstawić własną implementację.
 */
export interface DataSource {
  readonly kind: 'api'

  auth: {
    register: (input: RegisterInput) => R<AuthSession>
    login: (input: LoginInput) => R<AuthSession>
    /** Odtwarza sesję z refresh tokenu (ciasteczko httpOnly). */
    restore: () => R<AuthSession>
    logout: () => R<undefined>
    forgotPassword: (email: string) => R<undefined>
    resetPassword: (token: string, password: string) => R<undefined>
    providers: () => R<{ google: boolean }>
    /** Konto demo z przykładowymi danymi, bez rejestracji (usuwane po 24 h). */
    demo: (input: { locale: Locale; timezone?: string }) => R<AuthSession>
  }

  /** Konto, konfiguracja i dzisiejszy dzień jednym żądaniem (start panelu). */
  bootstrap: () => R<Bootstrap>

  account: {
    me: () => R<User>
    updateProfile: (input: ProfileInput) => R<User>
    changePassword: (input: PasswordChangeInput) => R<undefined>
    deleteAccount: (password: string) => R<undefined>
    /** Wszystkie dane konta jako obiekt JSON (do pobrania jako plik). */
    exportData: () => R<unknown>
  }

  settings: {
    get: () => R<UserSettings>
    update: (input: UserSettings) => R<UserSettings>
  }

  spScale: {
    get: () => R<Array<SpScaleStep>>
    replace: (steps: Array<Omit<SpScaleStep, 'id'>>) => R<Array<SpScaleStep>>
  }

  taskTypes: {
    list: () => R<Array<TaskType>>
    create: (input: TaskTypeInput) => R<TaskType>
    update: (id: string, input: TaskTypeInput) => R<TaskType>
    setArchived: (id: string, archived: boolean) => R<TaskType>
  }

  statuses: {
    list: () => R<Array<TaskStatus>>
    create: (input: TaskStatusInput) => R<TaskStatus>
    update: (id: string, input: TaskStatusInput) => R<TaskStatus>
    reorder: (ids: Array<string>) => R<Array<TaskStatus>>
    setDefault: (id: string) => R<Array<TaskStatus>>
    setArchived: (id: string, archived: boolean) => R<TaskStatus>
  }

  sprints: {
    getCadence: () => R<SprintCadence | null>
    setCadence: (input: SprintCadence | null) => R<SprintCadence | null>
    list: () => R<Array<Sprint>>
    create: (input: SprintInput) => R<Sprint>
    update: (id: string, input: SprintInput) => R<Sprint>
    remove: (id: string) => R<undefined>
  }

  projects: {
    list: () => R<Array<Project>>
    create: (input: ProjectInput) => R<Project>
    update: (id: string, input: ProjectInput) => R<Project>
    setArchived: (id: string, archived: boolean) => R<Project>
  }

  tags: {
    list: () => R<Array<Tag>>
    create: (input: TagInput) => R<Tag>
    update: (id: string, input: TagInput) => R<Tag>
    remove: (id: string) => R<undefined>
  }

  entries: {
    /** Wpisy z jednego dnia (YYYY-MM-DD), od najnowszych. */
    list: (workDate: string) => R<Array<TimeEntry>>
    /** Wpisy z zakresu dni włącznie (YYYY-MM-DD), do raportów. */
    range: (from: string, to: string) => R<Array<TimeEntry>>
    create: (input: TimeEntryInput) => R<TimeEntry>
    update: (id: string, input: TimeEntryInput) => R<TimeEntry>
    remove: (id: string) => R<undefined>
    /** Wszystkie wpisy tego samego zadania (ten sam link, a bez linku ten sam tytuł i typ). */
    forTask: (ref: TaskRef) => R<Array<TimeEntry>>
    /** Działający timer albo null. */
    running: () => R<TimeEntry | null>
    /** Startuje timer; poprzedni działający zatrzymuje się automatycznie. */
    start: (input: TimerStartInput) => R<TimerStartResult>
    /** Zatrzymuje timer teraz (czas serwera w strefie użytkownika); zadanie uznajemy za skończone. */
    stop: (id: string) => R<TimeEntry>
    /** Przerwa: sesja się kończy, zadanie trafia do wstrzymanych. */
    pause: (id: string) => R<TimeEntry>
    /** Nowa sesja tego samego zadania; działający timer innego zadania zostaje wstrzymany. */
    resume: (id: string) => R<TimerStartResult>
    /** Zadanie skończone: znika z listy wstrzymanych. */
    dismiss: (id: string) => R<undefined>
    /** Wstrzymane dziś zadania (najświeższe najpierw). */
    paused: () => R<Array<TimeEntry>>
  }

  templates: {
    list: () => R<Array<QuickTemplate>>
    create: (input: QuickTemplateInput) => R<QuickTemplate>
    update: (id: string, input: QuickTemplateInput) => R<QuickTemplate>
    reorder: (ids: Array<string>) => R<Array<QuickTemplate>>
    remove: (id: string) => R<undefined>
  }

  billing: {
    status: () => R<BillingStatus>
    /** Adres Stripe Checkout dla planu rocznego. */
    checkout: (plan: 'pro') => R<{ url: string }>
    /** Po powrocie z płatności: plan od razu, bez czekania na webhook. */
    sync: (sessionId: string) => R<{ plan: PlanCode; paid: boolean }>
    /** Adres Stripe Customer Portal (faktury, karta, anulowanie). */
    portal: () => R<{ url: string }>
  }

  /** Panel administratora: tylko dla roli „admin” (serwer sprawdza ją przy każdym żądaniu). */
  admin: {
    stats: () => R<AdminStats>
    users: (filter: AdminUserFilter) => R<AdminUserPage>
    updateUser: (id: string, change: AdminUserChange) => R<AdminUser>
    revokeSessions: (id: string) => R<undefined>
    deleteUser: (id: string) => R<undefined>
    actions: () => R<Array<AdminAction>>
  }
}
