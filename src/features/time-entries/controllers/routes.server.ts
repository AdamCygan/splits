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
    const userId = c.get('userId')
    if (c.req.query('date')) {
      const { date } = parse(dateQuery, c.req.query())
      return c.json(await listEntriesOn(userId, date))
    }
    const range = parse(rangeQuery, c.req.query())
    if (range.to < range.from) throw invalid('to')
    return c.json(await listEntriesInRange(userId, range.from, range.to))
  })

  .get('/running', async (c) => {
    return c.json(await getRunningEntry(c.get('userId')))
  })

  /** Wstrzymane dziś zadania (jedna pozycja na zadanie, najświeższe najpierw, najwyżej 5). */
  .get('/paused', async (c) => {
    const userId = c.get('userId')
    return c.json(await getPausedToday(userId))
  })

  /**
   * Wyszukiwarka palety poleceń: cała historia, tytuł, link i notatki (także nadgodzin
   * i przedłużeń), każde słowo osobno. Filtr w SQL (ILIKE po kolumnach użytkownika),
   * ranking i fragment notatki w domenie.
   */
  .get('/search/all', async (c) => {
    const userId = c.get('userId')
    const q = (c.req.query('q') ?? '').trim().slice(0, 200)
    return c.json(await searchAll(userId, q))
  })

  /** Wyszukiwarka zadań (także zakończonych) po tytule albo linku, do kontynuacji pracy. */
  .get('/search', async (c) => {
    const userId = c.get('userId')
    const q = (c.req.query('q') ?? '').trim().slice(0, 200)
    if (q.length < 2) return c.json([])
    const pattern = likePattern(q)
    return c.json(await searchTasks(userId, pattern))
  })

  .get('/unfinished', async (c) => {
    const userId = c.get('userId')
    return c.json(await getUnfinishedTasks(userId))
  })

  /** Zadanie zakończone (`finished: true`) albo z powrotem w toku. */
  .post('/task/finish', async (c) => {
    const userId = c.get('userId')
    const input = await body(c, taskFinishInput)
    return c.json(await finishTask(userId, input))
  })

  .get('/by-task', async (c) => {
    const ref = parse(taskRefInput, c.req.query())
    return c.json(await getTaskSessions(c.get('userId'), ref))
  })

  .post('/', async (c) => {
    const userId = c.get('userId')
    const input = await body(c, entryInput)
    return c.json(await createEntry(userId, input), 201)
  })

  .post('/timer', async (c) => {
    const userId = c.get('userId')
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
    return c.json(await startTimerFor(userId, input), 201)
  })

  /** Koniec pracy nad zadaniem: zatrzymany wpis nie trafia do wstrzymanych. */
  .post('/:id/stop', async (c) => {
    const userId = c.get('userId')
    return c.json(await stopEntry(userId, c.req.param('id')))
  })

  /** Przerwa: sesja się kończy, a zadanie czeka na pasku z przyciskiem „Wznów”. */
  .post('/:id/pause', async (c) => {
    const userId = c.get('userId')
    return c.json(await pauseEntry(userId, c.req.param('id')))
  })

  /**
   * Wznów: nowa sesja (nowy odcinek czasu) z tym samym tytułem, linkiem, typem, projektem i SP.
   * Działający timer innego zadania zostaje wstrzymany, więc można swobodnie skakać między zadaniami.
   */
  .post('/:id/resume', async (c) => {
    const userId = c.get('userId')
    return c.json(await resumeTask(userId, c.req.param('id')), 201)
  })

  /** Zadanie skończone: znika z paska wstrzymanych (zalogowany czas zostaje). */
  .post('/:id/dismiss', async (c) => {
    const userId = c.get('userId')
    await dismissPaused(userId, c.req.param('id'))
    return c.body(null, 204)
  })

  /**
   * Edycja zadania z raportu: tytuł, link, projekt i SP zmieniają się we wszystkich wpisach
   * zadania naraz (zadanie = wpisy z tym samym linkiem, a bez linku z tym samym typem i tytułem).
   */
  /** Usuwa zadanie: wszystkie jego sesje (także trwający timer) albo tylko te z `date`. */
  .post('/task/delete', async (c) => {
    const userId = c.get('userId')
    const input = await body(c, taskDeleteInput)
    return c.json(await deleteTask(userId, input))
  })

  .put('/task', async (c) => {
    const userId = c.get('userId')
    const input = await body(c, taskUpdateInput)
    return c.json(await updateTask(userId, input))
  })

  /** Sama notatka (np. odhaczony checkbox na liście), bez walidacji całego wpisu. */
  .patch('/:id/note', async (c) => {
    const userId = c.get('userId')
    const input = await body(c, noteInput)
    const note = input.note?.trim() ? input.note : null
    if ((note?.length ?? 0) > ENTRY_LIMITS.note) throw invalid('note')
    return c.json(await updateNote(userId, c.req.param('id'), note))
  })

  .put('/:id', async (c) => {
    const userId = c.get('userId')
    const id = c.req.param('id')
    const input = await body(c, entryInput)
    return c.json(await updateEntry(userId, id, input))
  })

  .delete('/:id', async (c) => {
    await deleteEntry(c.get('userId'), c.req.param('id'))
    return c.body(null, 204)
  })
