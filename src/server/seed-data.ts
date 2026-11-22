import { addDays, parseDate, startOfWeek, todayIn } from '#/domain/dates'
import { defaultSpRequirement } from '#/config/work-types'
import { scalePresets } from '#/domain/sp-scale'
import type { Locale } from '#/i18n/config'
import type {
  Project,
  QuickTemplate,
  SpScaleStep,
  Sprint,
  SprintCadence,
  Tag,
  TaskStatus,
  TaskType,
  TimeEntry,
  UserSettings,
} from '#/data/types'

export type Workspace = {
  settings: UserSettings
  spScale: Array<SpScaleStep>
  taskTypes: Array<TaskType>
  statuses: Array<TaskStatus>
  cadence: SprintCadence | null
  sprints: Array<Sprint>
  projects: Array<Project>
  tags: Array<Tag>
  templates: Array<QuickTemplate>
  /** Brak w przestrzeniach zapisanych przed dodaniem wpisów — czytamy przez `ws.entries ??= []`. */
  entries?: Array<TimeEntry>
}

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`

type SampleEntry = readonly [
  title: string,
  link: string | null,
  note: string | null,
]

/** Wcześniejsza praca w sprincie: rodzaj (indeks typu), SP, minuty, ile dni roboczych temu. */
type PastEntry = readonly [
  kind: number,
  sp: number | null,
  minutes: number,
  workdaysAgo: number,
  title: string,
  link: string | null,
  note: string | null,
]

/** Nazwy domyślne zapisujemy w języku użytkownika z chwili rejestracji (dalej są edytowalne). */
const names = {
  en: {
    types: {
      task: 'Task',
      code_review: 'Code review',
      pair_programming: 'Pair programming',
      additional_work: 'Extra work',
      meeting: 'Meeting',
    },
    taskLink: 'Link to task',
    mrLink: 'Merge request link',
    title: 'Title',
    statuses: ['To do', 'In progress', 'In review', 'Done'],
    pattern: 'Sprint {n}',
    projects: ['Payments', 'Mobile app'],
    tags: ['backend', 'frontend', 'bug'],
    templates: [
      ['Stand-up', 'Daily stand-up'],
      ['Code review', 'Code review'],
      ['Refinement', 'Backlog refinement'],
    ],
    entries: [
      [
        'PAY-142 Payment gateway integration',
        'https://acme.atlassian.net/browse/PAY-142',
        'Wired up the Stripe webhook handler and stored an idempotency key per event.\nTODO: retry policy for 5xx responses.',
      ],
      [
        'CR !481 Refund form validation',
        'https://gitlab.com/acme/shop/-/merge_requests/481',
        'Asked for a test on partial refunds. Approved after the fix.',
      ],
      [
        'Queue migration with Kate',
        null,
        'Moved email jobs to the new queue. Kate drove, I reviewed the consumer config.',
      ],
      ['Staging certificate hotfix', null, null],
    ] satisfies Array<SampleEntry>,
    history: [
      'Read the Stripe docs and sketched the webhook flow. Agreed on event types with the backend team.',
      'Built the signature check. Lost an hour on a clock-skew bug in the test environment.',
    ],
    overtime:
      'Certificate expired at 19:30, renewed it and redeployed staging so QA could test in the morning.',
    ranOver:
      'Scope of the refund epic was unclear, we split it into three tickets before closing.',
    past: [
      [
        0,
        5,
        185,
        4,
        'PAY-139 Refund API endpoint',
        'https://acme.atlassian.net/browse/PAY-139',
        'Endpoint and validation done. Partial refunds need their own ledger entry.',
      ],
      [
        0,
        5,
        150,
        3,
        'PAY-139 Refund API endpoint',
        'https://acme.atlassian.net/browse/PAY-139',
        'Ledger entries and tests for partial refunds. Ready for review.',
      ],
      [
        0,
        2,
        140,
        4,
        'MOB-77 Push notification settings',
        'https://acme.atlassian.net/browse/MOB-77',
        null,
      ],
      [
        1,
        null,
        35,
        3,
        'CR !477 Retry queue for webhooks',
        'https://gitlab.com/acme/shop/-/merge_requests/477',
        'Suggested exponential backoff with jitter.',
      ],
      [
        1,
        0.5,
        20,
        2,
        'CR !479 Currency rounding',
        'https://gitlab.com/acme/shop/-/merge_requests/479',
        null,
      ],
      [
        2,
        null,
        75,
        3,
        'Flaky checkout test with Tom',
        null,
        'Found a race in the test fixture. Tom fixed it, I wrote the regression test.',
      ],
      [
        3,
        1,
        45,
        2,
        'Incident follow-up: payment timeouts',
        null,
        'Wrote the postmortem timeline.',
      ],
      [4, null, 60, 4, 'Sprint planning', null, null],
      [4, null, 15, 2, 'Daily stand-up', null, null],
    ] satisfies Array<PastEntry>,
  },
  pl: {
    types: {
      task: 'Zadanie',
      code_review: 'Code Review',
      pair_programming: 'Pair programming',
      additional_work: 'Prace dodatkowe',
      meeting: 'Spotkanie',
    },
    taskLink: 'Link do zadania',
    mrLink: 'Link do MR',
    title: 'Tytuł',
    statuses: ['Do zrobienia', 'W trakcie', 'Do review', 'Gotowe'],
    pattern: 'Sprint {n}',
    projects: ['Płatności', 'Aplikacja mobilna'],
    tags: ['backend', 'frontend', 'bug'],
    templates: [
      ['Daily', 'Daily'],
      ['Code Review', 'Code Review'],
      ['Refinement', 'Refinement backlogu'],
    ],
    entries: [
      [
        'PAY-142 Integracja bramki płatności',
        'https://firma.atlassian.net/browse/PAY-142',
        'Podpięty handler webhooków Stripe, klucz idempotencji zapisany per zdarzenie.\nTODO: polityka ponowień dla odpowiedzi 5xx.',
      ],
      [
        'CR !481 Walidacja formularza zwrotów',
        'https://gitlab.com/firma/shop/-/merge_requests/481',
        'Poprosiłem o test częściowych zwrotów. Zatwierdzone po poprawce.',
      ],
      [
        'Migracja kolejek z Kasią',
        null,
        'Przenieśliśmy joby mailowe na nową kolejkę. Kasia pisała, ja sprawdzałem konfigurację konsumenta.',
      ],
      ['Hotfix certyfikatu na stagingu', null, null],
    ] satisfies Array<SampleEntry>,
    history: [
      'Przeczytałem dokumentację Stripe i rozrysowałem przepływ webhooków. Ustaliliśmy typy zdarzeń z backendem.',
      'Zrobiłem weryfikację podpisu. Godzina straty na błąd z przesunięciem zegara w środowisku testowym.',
    ],
    overtime:
      'Certyfikat wygasł o 19:30, odnowiłem go i wdrożyłem staging ponownie, żeby QA mógł rano testować.',
    ranOver:
      'Zakres epika zwrotów był niejasny, przed końcem podzieliliśmy go na trzy tickety.',
    past: [
      [
        0,
        5,
        185,
        4,
        'PAY-139 Endpoint zwrotów w API',
        'https://firma.atlassian.net/browse/PAY-139',
        'Endpoint i walidacja gotowe. Częściowe zwroty potrzebują osobnego wpisu w księdze.',
      ],
      [
        0,
        5,
        150,
        3,
        'PAY-139 Endpoint zwrotów w API',
        'https://firma.atlassian.net/browse/PAY-139',
        'Wpisy w księdze i testy częściowych zwrotów. Gotowe do review.',
      ],
      [
        0,
        2,
        140,
        4,
        'MOB-77 Ustawienia powiadomień push',
        'https://firma.atlassian.net/browse/MOB-77',
        null,
      ],
      [
        1,
        null,
        35,
        3,
        'CR !477 Kolejka ponowień webhooków',
        'https://gitlab.com/firma/shop/-/merge_requests/477',
        'Zaproponowałem wykładnicze opóźnienie z losowym rozrzutem.',
      ],
      [
        1,
        0.5,
        20,
        2,
        'CR !479 Zaokrąglanie walut',
        'https://gitlab.com/firma/shop/-/merge_requests/479',
        null,
      ],
      [
        2,
        null,
        75,
        3,
        'Niestabilny test koszyka z Tomkiem',
        null,
        'Znaleźliśmy wyścig w fixture testu. Tomek poprawił, ja dopisałem test regresji.',
      ],
      [
        3,
        1,
        45,
        2,
        'Po incydencie: timeouty płatności',
        null,
        'Spisałem oś czasu do postmortemu.',
      ],
      [4, null, 60, 4, 'Planowanie sprintu', null, null],
      [4, null, 15, 2, 'Daily', null, null],
    ] satisfies Array<PastEntry>,
  },
} satisfies Record<Locale, unknown>

/**
 * Dane startowe nowego konta: typy pracy, statusy, skala SP, kadencja sprintów i ustawienia.
 * `withSamples` dokłada przykładowe projekty, szablony i wpisy (testy e2e, zrzuty ekranu).
 */
export function seedWorkspace(
  locale: Locale,
  withSamples: boolean,
  timezone: string = 'UTC',
): Workspace {
  const n = names[locale]
  const today = todayIn(timezone)

  const type = (
    kind: TaskType['kind'],
    sortOrder: number,
    patch: Partial<TaskType>,
  ): TaskType => ({
    id: newId(),
    kind,
    name: n.types[kind as keyof typeof n.types],
    color: '#3D3BF3',
    isSystem: true,
    titleLabel: n.title,
    linkRequirement: 'hidden',
    linkLabel: 'Link',
    // Notatki („co robiłem”) są dostępne w każdym typie; można je ukryć w ustawieniach.
    descriptionRequirement: 'optional',
    storyPointsRequirement: defaultSpRequirement[kind],
    defaultStoryPoints: defaultSpRequirement[kind] === 'required' ? 1 : null,
    defaultTimeInput: 'duration',
    countsAsFocusWork: true,
    sortOrder,
    archivedAt: null,
    ...patch,
  })

  const taskTypes = [
    type('task', 0, {
      color: '#3D3BF3',
      linkRequirement: 'optional',
      linkLabel: n.taskLink,
      descriptionRequirement: 'optional',
      defaultTimeInput: 'range',
    }),
    type('code_review', 1, {
      color: '#E8A33D',
      linkRequirement: 'required',
      linkLabel: n.mrLink,
    }),
    type('pair_programming', 2, { color: '#0F9F86' }),
    type('additional_work', 3, { color: '#DB4A7C' }),
    type('meeting', 4, {
      color: '#8A8FA8',
      descriptionRequirement: 'optional',
      countsAsFocusWork: false,
    }),
  ]

  const statusColors = ['#8A8FA8', '#2C8FD6', '#E8A33D', '#0F9F86']
  const categories: Array<TaskStatus['category']> = [
    'todo',
    'in_progress',
    'in_progress',
    'done',
  ]
  const statuses: Array<TaskStatus> = n.statuses.map((name, i) => ({
    id: newId(),
    name,
    category: categories[i]!,
    color: statusColors[i]!,
    isSystem: true,
    isDefault: i === 0,
    sortOrder: i,
    archivedAt: null,
  }))

  // Kadencja 2-tygodniowa: poprzedni sprint, bieżący i kolejny od razu widoczne.
  const cadence: SprintCadence = {
    lengthDays: 14,
    anchorDate: addDays(startOfWeek(today, 1), -21),
    namePattern: n.pattern,
    autoCreate: true,
  }

  const settings: UserSettings = {
    workdayTargetMinutes: 480,
    workingDays: [1, 2, 3, 4, 5],
    weekStartsOn: 1,
    timeRoundingMinutes: 0,
    timezone,
    locale,
    dailyReminderAt: null,
    summaryTemplate: null,
    breakMinutes: 30,
  }

  const projects: Array<Project> = withSamples
    ? [
        {
          id: newId(),
          name: n.projects[0]!,
          key: 'PAY',
          color: '#3D3BF3',
          archivedAt: null,
        },
        {
          id: newId(),
          name: n.projects[1]!,
          key: 'MOB',
          color: '#0F9F86',
          archivedAt: null,
        },
      ]
    : []

  const tags: Array<Tag> = withSamples
    ? n.tags.map((name, i) => ({
        id: newId(),
        name,
        color: ['#2C8FD6', '#8B5CF6', '#E5603B'][i]!,
      }))
    : []

  const meeting = taskTypes[4]!
  const review = taskTypes[1]!
  const templates: Array<QuickTemplate> = withSamples
    ? [
        {
          id: newId(),
          taskTypeId: meeting.id,
          projectId: null,
          askProject: false,
          label: n.templates[0]![0]!,
          title: n.templates[0]![1]!,
          storyPoints: null,
          defaultDurationMinutes: 15,
          hotkey: 1,
          sortOrder: 0,
          // Daily: w poniedziałki później (po planowaniu tygodnia), w pozostałe dni rano.
          schedule: [
            { day: 1, time: '10:00' },
            { day: 2, time: '09:30' },
            { day: 3, time: '09:30' },
            { day: 4, time: '09:30' },
            { day: 5, time: '09:30' },
          ],
        },
        {
          id: newId(),
          taskTypeId: review.id,
          projectId: null,
          // Code review robi się w każdym repo: projekt wybierany przy użyciu.
          askProject: projects.length > 1,
          label: n.templates[1]![0]!,
          title: n.templates[1]![1]!,
          storyPoints: 0.5,
          defaultDurationMinutes: 25,
          hotkey: 2,
          sortOrder: 1,
          schedule: [],
        },
        {
          id: newId(),
          taskTypeId: meeting.id,
          projectId: null,
          askProject: false,
          label: n.templates[2]![0]!,
          title: n.templates[2]![1]!,
          storyPoints: null,
          defaultDurationMinutes: 60,
          hotkey: 3,
          sortOrder: 2,
          schedule: [],
        },
      ]
    : []

  return {
    settings,
    spScale: scalePresets.fibonacci.map((s) => ({ id: newId(), ...s })),
    taskTypes,
    statuses,
    cadence,
    sprints: [],
    projects,
    tags,
    templates,
    entries: withSamples
      ? sampleEntries(
          n.history,
          n.entries,
          n.past,
          n.overtime,
          n.ranOver,
          taskTypes,
          projects,
          todayIn(settings.timezone),
        )
      : [],
  }
}

/** Przykładowy dzień w koncie demo: każdy rodzaj pracy, część wpisów z notatkami. */
function sampleEntries(
  history: ReadonlyArray<string>,
  texts: ReadonlyArray<SampleEntry>,
  past: ReadonlyArray<PastEntry>,
  overtimeNote: string,
  ranOverNote: string,
  types: Array<TaskType>,
  projects: Array<Project>,
  workDate: string,
): Array<TimeEntry> {
  const plan: Array<
    [
      kind: number,
      sp: number | null,
      start: string | null,
      end: string | null,
      minutes: number,
    ]
  > = [
    [0, 3, '09:15', '11:25', 130],
    [1, 0.5, null, null, 25],
    [2, null, '12:30', '13:30', 60],
    [3, 0.5, null, null, 40],
  ]
  // Dwa poprzednie dni tego samego zadania: podsumowanie zadania ma z czego liczyć.
  const earlier: Array<TimeEntry> = history.map((note, i) => ({
    id: newId(),
    taskTypeId: types[0]!.id,
    projectId: projects[0]?.id ?? null,
    title: texts[0]![0],
    link: texts[0]![1],
    storyPoints: 3,
    workDate: addDays(workDate, i - history.length),
    startTime: i === 0 ? '10:00' : '13:00',
    endTime: i === 0 ? '11:35' : '15:10',
    durationMinutes: i === 0 ? 95 : 130,
    note,
    overtimeMinutes: null,
    overtimeNote: null,
    // Estymata zadania podana przed pracą: raport pokaże, o ile zadanie ją przekroczyło.
    estimateMinutes: 300,
    extensionMinutes: null,
    extensionNote: null,
    finishedAt: null,
    running: false,
    paused: false,
    startedAt: null,
    createdAt: new Date(
      Date.now() - (history.length - i) * 86_400_000,
    ).toISOString(),
  }))
  const today = plan
    .map(([kind, storyPoints, startTime, endTime, durationMinutes], i) => ({
      id: newId(),
      taskTypeId: types[kind]!.id,
      projectId: i === 0 ? (projects[0]?.id ?? null) : null,
      title: texts[i]![0],
      link: texts[i]![1],
      storyPoints,
      workDate,
      startTime,
      endTime,
      durationMinutes,
      note: texts[i]![2],
      // Wieczorny hotfix w przykładowych danych: pokazuje nadgodziny z opisem.
      overtimeMinutes: kind === 3 ? durationMinutes : null,
      overtimeNote: kind === 3 ? overtimeNote : null,
      estimateMinutes: i === 0 ? 300 : null,
      extensionMinutes: null,
      extensionNote: null,
      finishedAt: null,
      running: false,
      paused: false,
      startedAt: null,
      createdAt: new Date(
        Date.now() - (plan.length - i) * 60_000,
      ).toISOString(),
    }))
    .reverse()
  const workdaysBack = (n: number) => {
    let date = workDate
    for (let left = n; left > 0;) {
      date = addDays(date, -1)
      const day = parseDate(date).getUTCDay()
      if (day !== 0 && day !== 6) left -= 1
    }
    return date
  }
  const sprintWork: Array<TimeEntry> = past.map(
    ([kind, storyPoints, minutes, ago, title, link, note], i) => ({
      id: newId(),
      taskTypeId: types[kind]!.id,
      projectId: link?.includes('MOB-')
        ? (projects[1]?.id ?? null)
        : link?.includes('PAY-')
          ? (projects[0]?.id ?? null)
          : null,
      title,
      link,
      storyPoints,
      workDate: workdaysBack(ago),
      startTime: null,
      endTime: null,
      // Planowanie sprintu na 1 h przeciągnęło się o 20 min: przedłużenie z powodem.
      durationMinutes: kind === 4 && minutes >= 60 ? minutes + 20 : minutes,
      note,
      overtimeMinutes: null,
      overtimeNote: null,
      estimateMinutes: null,
      extensionMinutes: kind === 4 && minutes >= 60 ? 20 : null,
      extensionNote: kind === 4 && minutes >= 60 ? ranOverNote : null,
      // Zadania sprintu są zakończone; MOB-77 czeka na dokończenie (sekcja na Dziś).
      finishedAt: link?.includes('MOB-77')
        ? null
        : new Date(Date.now() - (ago - 1) * 86_400_000).toISOString(),
      running: false,
      paused: false,
      startedAt: null,
      createdAt: new Date(
        Date.now() - (ago * 86_400_000 + (past.length - i) * 60_000),
      ).toISOString(),
    }),
  )
  return [...today, ...earlier, ...sprintWork]
}
