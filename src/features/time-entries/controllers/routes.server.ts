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
  .get('/', async (c) => {
    const scope = scopeOf(c)
    if (c.req.query('date')) {
      const { date } = parse(dateQuery, c.req.query())
      return c.json(await listEntriesOn(scope, date))
    }
    const range = parse(rangeQuery, c.req.query())
    if (range.to < range.from) throw invalid('to')
    return c.json(await listEntriesInRange(scope, range.from, range.to))
  })

  .get('/running', async (c) => {
    return c.json(await getRunningEntry(scopeOf(c)))
  })

  /** Wstrzymane dziś zadania (jedna pozycja na zadanie, najświeższe najpierw, najwyżej 5). */
  .get('/paused', async (c) => {
    const scope = scopeOf(c)
    return c.json(await getPausedToday(scope))
  })

  /**
   * Wyszukiwarka palety poleceń: cała historia, tytuł, link i notatki (także nadgodzin
   * i przedłużeń), każde słowo osobno. Filtr w SQL (ILIKE po kolumnach użytkownika),
   * ranking i fragment notatki w domenie.
   */
  .get('/search/all', async (c) => {
    const scope = scopeOf(c)
    const q = (c.req.query('q') ?? '').trim().slice(0, 200)
    return c.json(await searchAll(scope, q))
  })

  /** Wyszukiwarka zadań (także zakończonych) po tytule albo linku, do kontynuacji pracy. */
  .get('/search', async (c) => {
    const scope = scopeOf(c)
    const q = (c.req.query('q') ?? '').trim().slice(0, 200)
    if (q.length < 2) return c.json([])
    const pattern = likePattern(q)
    return c.json(await searchTasks(scope, pattern))
  })

  .get('/unfinished', async (c) => {
    const scope = scopeOf(c)
    return c.json(await getUnfinishedTasks(scope))
  })

  /** Zadanie zakończone (`finished: true`) albo z powrotem w toku. */
  .post('/task/finish', async (c) => {
    const scope = scopeOf(c)
    const input = await body(c, taskFinishInput)
    return c.json(await finishTask(scope, input))
  })

  .get('/by-task', async (c) => {
    const ref = parse(taskRefInput, c.req.query())
    return c.json(await getTaskSessions(scopeOf(c), ref))
  })

  .post('/', async (c) => {
    const scope = scopeOf(c)
    const input = await body(c, entryInput)
    return c.json(await createEntry(scope, input), 201)
  })

  .post('/timer', async (c) => {
    const scope = scopeOf(c)
    const raw = await body(c, timerInput)
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
    return c.json(await startTimerFor(scope, input), 201)
  })

  /** Koniec pracy nad zadaniem: zatrzymany wpis nie trafia do wstrzymanych. */
  .post('/:id/stop', async (c) => {
    const scope = scopeOf(c)
    return c.json(await stopEntry(scope, c.req.param('id')))
  })

  /** Przerwa: sesja się kończy, a zadanie czeka na pasku z przyciskiem „Wznów”. */
  .post('/:id/pause', async (c) => {
    const scope = scopeOf(c)
    return c.json(await pauseEntry(scope, c.req.param('id')))
  })

  /**
   * Wznów: nowa sesja (nowy odcinek czasu) z tym samym tytułem, linkiem, typem, projektem i SP.
   * Działający timer innego zadania zostaje wstrzymany, więc można swobodnie skakać między zadaniami.
   */
  .post('/:id/resume', async (c) => {
    const scope = scopeOf(c)
    return c.json(await resumeTask(scope, c.req.param('id')), 201)
  })

  /** Zadanie skończone: znika z paska wstrzymanych (zalogowany czas zostaje). */
  .post('/:id/dismiss', async (c) => {
    const scope = scopeOf(c)
    await dismissPaused(scope, c.req.param('id'))
    return c.body(null, 204)
  })

  /**
   * Edycja zadania z raportu: tytuł, link, projekt i SP zmieniają się we wszystkich wpisach
   * zadania naraz (zadanie = wpisy z tym samym linkiem, a bez linku z tym samym typem i tytułem).
   */
  /** Usuwa zadanie: wszystkie jego sesje (także trwający timer) albo tylko te z `date`. */
  .post('/task/delete', async (c) => {
    const scope = scopeOf(c)
    const input = await body(c, taskDeleteInput)
    return c.json(await deleteTask(scope, input))
  })

  .put('/task', async (c) => {
    const scope = scopeOf(c)
    const input = await body(c, taskUpdateInput)
    return c.json(await updateTask(scope, input))
  })

  /** Sama notatka (np. odhaczony checkbox na liście), bez walidacji całego wpisu. */
  .patch('/:id/note', async (c) => {
    const scope = scopeOf(c)
    const input = await body(c, noteInput)
    const note = input.note?.trim() ? input.note : null
    if ((note?.length ?? 0) > ENTRY_LIMITS.note) throw invalid('note')
    return c.json(await updateNote(scope, c.req.param('id'), note))
  })

  .put('/:id', async (c) => {
    const scope = scopeOf(c)
    const id = c.req.param('id')
    const input = await body(c, entryInput)
    return c.json(await updateEntry(scope, id, input))
  })

  .delete('/:id', async (c) => {
    await deleteEntry(scopeOf(c), c.req.param('id'))
    return c.body(null, 204)
  })
