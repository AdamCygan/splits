import { scopeOf } from '#/server/http/scope'
import {
  listEntriesOn,
  listEntriesInRange,
  getRunningEntry,
  getPausedToday,
  searchAll,
  searchTasks,
  getUnfinishedTasks,
  finishTask,
  getTaskSessions,
  createEntry,
  startTimerFor,
  stopEntry,
  pauseEntry,
  resumeTask,
  dismissPaused,
  deleteTask,
  updateTask,
  updateNote,
  updateEntry,
  deleteEntry,
} from '../data/repository.server'
import { Hono } from 'hono'
import type { TimeEntryInput } from '#/features/time-entries/data/dto'
import { ENTRY_LIMITS } from '#/features/time-entries/domain/entries'
import { likePattern } from '#/features/tasks/domain/task-search'
import type { AppEnv } from '#/server/http/context'
import { invalid } from '#/server/http/errors'
import { body, dateQuery, parse, rangeQuery } from '#/server/http/inputs'
import {
  entryInput,
  taskRefInput,
  taskUpdateInput,
  taskDeleteInput,
  noteInput,
  taskFinishInput,
  timerInput,
} from '../data/inputs.server'

export const entryRoutes = new Hono<AppEnv>()
  .get('/', async (context) => {
    const scope = scopeOf(context)
    if (context.req.query('date')) {
      const { date } = parse(dateQuery, context.req.query())
      return context.json(await listEntriesOn(scope, date))
    }
    const range = parse(rangeQuery, context.req.query())
    if (range.to < range.from) throw invalid('to')
    return context.json(await listEntriesInRange(scope, range.from, range.to))
  })

  .get('/running', async (context) => {
    return context.json(await getRunningEntry(scopeOf(context)))
  })

  /** Wstrzymane dziś zadania (jedna pozycja na zadanie, najświeższe najpierw, najwyżej 5). */
  .get('/paused', async (context) => {
    const scope = scopeOf(context)
    return context.json(await getPausedToday(scope))
  })

  /**
   * Wyszukiwarka palety poleceń: cała historia, tytuł, link i notatki (także nadgodzin
   * i przedłużeń), każde słowo osobno. Filtr w SQL (ILIKE po kolumnach użytkownika),
   * ranking i fragment notatki w domenie.
   */
  .get('/search/all', async (context) => {
    const scope = scopeOf(context)
    const query = (context.req.query('q') ?? '').trim().slice(0, 200)
    return context.json(await searchAll(scope, query))
  })

  /** Wyszukiwarka zadań (także zakończonych) po tytule albo linku, do kontynuacji pracy. */
  .get('/search', async (context) => {
    const scope = scopeOf(context)
    const query = (context.req.query('q') ?? '').trim().slice(0, 200)
    if (query.length < 2) return context.json([])
    const pattern = likePattern(query)
    return context.json(await searchTasks(scope, pattern))
  })

  .get('/unfinished', async (context) => {
    const scope = scopeOf(context)
    return context.json(await getUnfinishedTasks(scope))
  })

  /** Zadanie zakończone (`finished: true`) albo z powrotem w toku. */
  .post('/task/finish', async (context) => {
    const scope = scopeOf(context)
    const input = await body(context, taskFinishInput)
    return context.json(await finishTask(scope, input))
  })

  .get('/by-task', async (context) => {
    const ref = parse(taskRefInput, context.req.query())
    return context.json(await getTaskSessions(scopeOf(context), ref))
  })

  .post('/', async (context) => {
    const scope = scopeOf(context)
    const input = await body(context, entryInput)
    return context.json(await createEntry(scope, input), 201)
  })

  .post('/timer', async (context) => {
    const scope = scopeOf(context)
    const raw = await body(context, timerInput)
    const input: TimeEntryInput = {
      ...raw,
      endTime: null,
      durationMinutes: 0,
      overtimeMinutes: null,
      overtimeNote: null,
      extensionMinutes: null,
      extensionNote: null,
      running: true,
    }
    return context.json(await startTimerFor(scope, input), 201)
  })

  /** Koniec pracy nad zadaniem: zatrzymany wpis nie trafia do wstrzymanych. */
  .post('/:id/stop', async (context) => {
    const scope = scopeOf(context)
    return context.json(await stopEntry(scope, context.req.param('id')))
  })

  /** Przerwa: sesja się kończy, a zadanie czeka na pasku z przyciskiem „Wznów”. */
  .post('/:id/pause', async (context) => {
    const scope = scopeOf(context)
    return context.json(await pauseEntry(scope, context.req.param('id')))
  })

  /**
   * Wznów: nowa sesja (nowy odcinek czasu) z tym samym tytułem, linkiem, typem, projektem i SP.
   * Działający timer innego zadania zostaje wstrzymany, więc można swobodnie skakać między zadaniami.
   */
  .post('/:id/resume', async (context) => {
    const scope = scopeOf(context)
    return context.json(await resumeTask(scope, context.req.param('id')), 201)
  })

  /** Zadanie skończone: znika z paska wstrzymanych (zalogowany czas zostaje). */
  .post('/:id/dismiss', async (context) => {
    const scope = scopeOf(context)
    await dismissPaused(scope, context.req.param('id'))
    return context.body(null, 204)
  })

  /**
   * Edycja zadania z raportu: tytuł, link, projekt i SP zmieniają się we wszystkich wpisach
   * zadania naraz (zadanie = wpisy z tym samym linkiem, a bez linku z tym samym typem i tytułem).
   */
  /** Usuwa zadanie: wszystkie jego sesje (także trwający timer) albo tylko te z `date`. */
  .post('/task/delete', async (context) => {
    const scope = scopeOf(context)
    const input = await body(context, taskDeleteInput)
    return context.json(await deleteTask(scope, input))
  })

  .put('/task', async (context) => {
    const scope = scopeOf(context)
    const input = await body(context, taskUpdateInput)
    return context.json(await updateTask(scope, input))
  })

  /** Sama notatka (np. odhaczony checkbox na liście), bez walidacji całego wpisu. */
  .patch('/:id/note', async (context) => {
    const scope = scopeOf(context)
    const input = await body(context, noteInput)
    const note = input.note?.trim() ? input.note : null
    if ((note?.length ?? 0) > ENTRY_LIMITS.note) throw invalid('note')
    return context.json(await updateNote(scope, context.req.param('id'), note))
  })

  .put('/:id', async (context) => {
    const scope = scopeOf(context)
    const id = context.req.param('id')
    const input = await body(context, entryInput)
    return context.json(await updateEntry(scope, id, input))
  })

  .delete('/:id', async (context) => {
    await deleteEntry(scopeOf(context), context.req.param('id'))
    return context.body(null, 204)
  })
