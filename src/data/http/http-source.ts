import { z } from 'zod'
import { apiRequest, emptyResponse } from '#/lib/api-client'
import type { DataSource } from '../source'
import * as s from './schemas'

/** Źródło danych "api": wywołania API aplikacji (src/server, Hono pod /api/v1). */
const base = '/api/v1'
const get = <T>(path: string, schema: z.ZodType<T>) =>
  apiRequest(`${base}${path}`, { schema })
const send = <T>(
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  schema: z.ZodType<T>,
  body?: unknown,
) => apiRequest(`${base}${path}`, { method, schema, body })
/** Endpointy auth: 401 oznacza złe dane, a nie wygasłą sesję — bez automatycznego odświeżania. */
const auth = <T>(path: string, schema: z.ZodType<T>, body?: unknown) =>
  apiRequest(`${base}/auth${path}`, {
    method: 'POST',
    schema,
    body,
    retryOnUnauthorized: false,
  })

/** Parametry zapytania bez pustych wartości („?a=1&b=x” albo pusty tekst). */
const queryString = (params: Record<string, string | number | undefined>) => {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params))
    if (value !== undefined && value !== '') query.set(key, String(value))
  const text = query.toString()
  return text ? `?${text}` : ''
}

const archive = <T>(
  resource: string,
  id: string,
  archived: boolean,
  schema: z.ZodType<T>,
) =>
  send('POST', `/${resource}/${id}/${archived ? 'archive' : 'restore'}`, schema)

export const httpSource: DataSource = {
  kind: 'api',

  auth: {
    register: (input) => auth('/register', s.sessionSchema, input),
    login: (input) => auth('/login', s.loginResultSchema, input),
    loginWithCode: (mfaToken, code) =>
      auth('/login/2fa', s.sessionSchema, { mfaToken, code }),
    confirmEmail: (token) =>
      auth(
        '/email/confirm',
        z.object({ kind: z.enum(['verified', 'changed']) }),
        { token },
      ),
    restore: () => auth('/refresh', s.sessionSchema),
    logout: () => auth('/logout', emptyResponse),
    forgotPassword: (email) =>
      auth('/forgot-password', emptyResponse, { email }),
    resetPassword: (token, password) =>
      auth('/reset-password', emptyResponse, { token, password }),
    providers: () =>
      apiRequest(`${base}/auth/providers`, {
        schema: z.object({ google: z.boolean() }),
        retryOnUnauthorized: false,
      }),
    demo: (input) => auth('/demo', s.sessionSchema, input),
  },

  bootstrap: () => get('/bootstrap', s.bootstrapSchema),

  account: {
    me: () => get('/account', s.userSchema),
    updateProfile: (input) =>
      send('PUT', '/account/profile', s.userSchema, input),
    changePassword: (input) =>
      send('POST', '/account/password', emptyResponse, input),
    sendDeleteCode: () => send('POST', '/account/delete-code', emptyResponse),
    deleteAccount: (code) =>
      send('DELETE', '/account', emptyResponse, { code }),
    security: () => get('/account/security', s.securityStatusSchema),
    changeEmail: (input) =>
      send('POST', '/account/email', emptyResponse, input),
    cancelEmailChange: () =>
      send('DELETE', '/account/email/pending', emptyResponse),
    resendVerification: () =>
      send('POST', '/account/email/verify', emptyResponse),
    twoFactorSetup: () =>
      send(
        'POST',
        '/account/2fa/setup',
        z.object({ secret: z.string(), otpauthUrl: z.string() }),
      ),
    twoFactorEnable: (input) =>
      send(
        'POST',
        '/account/2fa/enable',
        z.object({ recoveryCodes: z.array(z.string()) }),
        input,
      ),
    twoFactorDisable: (input) =>
      send('POST', '/account/2fa/disable', emptyResponse, input),
    newRecoveryCodes: (input) =>
      send(
        'POST',
        '/account/2fa/recovery-codes',
        z.object({ recoveryCodes: z.array(z.string()) }),
        input,
      ),
    sessions: () => get('/account/sessions', z.array(s.activeSessionSchema)),
    revokeSession: (id) =>
      send('DELETE', `/account/sessions/${id}`, emptyResponse),
    revokeOtherSessions: () =>
      send('POST', '/account/sessions/revoke-others', emptyResponse),
    exportData: () => get('/account/export', z.unknown()),
  },

  settings: {
    get: () => get('/settings', s.settingsSchema),
    update: (input) => send('PUT', '/settings', s.settingsSchema, input),
  },

  spScale: {
    get: () => get('/story-point-scale', s.scaleSchema),
    replace: (steps) =>
      send('PUT', '/story-point-scale', s.scaleSchema, { steps }),
  },

  taskTypes: {
    list: () => get('/task-types', z.array(s.taskTypeSchema)),
    create: (input) => send('POST', '/task-types', s.taskTypeSchema, input),
    update: (id, input) =>
      send('PUT', `/task-types/${id}`, s.taskTypeSchema, input),
    setArchived: (id, archived) =>
      archive('task-types', id, archived, s.taskTypeSchema),
  },

  statuses: {
    list: () => get('/task-statuses', z.array(s.statusSchema)),
    create: (input) => send('POST', '/task-statuses', s.statusSchema, input),
    update: (id, input) =>
      send('PUT', `/task-statuses/${id}`, s.statusSchema, input),
    reorder: (ids) =>
      send('PUT', '/task-statuses/order', z.array(s.statusSchema), { ids }),
    setDefault: (id) =>
      send('POST', `/task-statuses/${id}/default`, z.array(s.statusSchema)),
    setArchived: (id, archived) =>
      archive('task-statuses', id, archived, s.statusSchema),
  },

  breaks: {
    list: (date) =>
      get(
        `/breaks?${new URLSearchParams({ date })}`,
        z.array(s.workBreakSchema),
      ),
    running: () => get('/breaks/running', s.workBreakSchema.nullable()),
    start: () =>
      send(
        'POST',
        '/breaks/start',
        z.object({
          break: s.workBreakSchema,
          paused: s.timeEntrySchema.nullable(),
        }),
      ),
    end: (id, resume) =>
      send(
        'POST',
        `/breaks/${id}/end`,
        z.object({
          break: s.workBreakSchema,
          resumed: s.timeEntrySchema.nullable(),
        }),
        { resume },
      ),
    add: (input) => send('POST', '/breaks', s.workBreakSchema, input),
    remove: (id) => send('DELETE', `/breaks/${id}`, emptyResponse),
  },

  daysOff: {
    list: (from, to) =>
      get(
        `/days-off?${new URLSearchParams({ from, to })}`,
        z.array(s.dayOffSchema),
      ),
    set: (input) => send('PUT', '/days-off', z.array(s.dayOffSchema), input),
    remove: (from, to) =>
      send(
        'DELETE',
        `/days-off?${new URLSearchParams({ from, to })}`,
        emptyResponse,
      ),
  },

  sprints: {
    getCadence: () => get('/sprints/cadence', s.cadenceSchema),
    setCadence: (input) =>
      input
        ? send('PUT', '/sprints/cadence', s.cadenceSchema, input)
        : send('DELETE', '/sprints/cadence', s.cadenceSchema),
    list: () => get('/sprints', z.array(s.sprintSchema)),
    create: (input) => send('POST', '/sprints', s.sprintSchema, input),
    update: (id, input) => send('PUT', `/sprints/${id}`, s.sprintSchema, input),
    remove: (id) => send('DELETE', `/sprints/${id}`, emptyResponse),
  },

  projects: {
    list: () => get('/projects', z.array(s.projectSchema)),
    create: (input) => send('POST', '/projects', s.projectSchema, input),
    update: (id, input) =>
      send('PUT', `/projects/${id}`, s.projectSchema, input),
    setArchived: (id, archived) =>
      archive('projects', id, archived, s.projectSchema),
  },

  tags: {
    list: () => get('/tags', z.array(s.tagSchema)),
    create: (input) => send('POST', '/tags', s.tagSchema, input),
    update: (id, input) => send('PUT', `/tags/${id}`, s.tagSchema, input),
    remove: (id) => send('DELETE', `/tags/${id}`, emptyResponse),
  },

  entries: {
    list: (workDate) =>
      get(
        `/time-entries?date=${encodeURIComponent(workDate)}`,
        z.array(s.timeEntrySchema),
      ),
    range: (from, to) =>
      get(
        `/time-entries?${new URLSearchParams({ from, to }).toString()}`,
        z.array(s.timeEntrySchema),
      ),
    create: (input) => send('POST', '/time-entries', s.timeEntrySchema, input),
    update: (id, input) =>
      send('PUT', `/time-entries/${id}`, s.timeEntrySchema, input),
    remove: (id) => send('DELETE', `/time-entries/${id}`, emptyResponse),
    forTask: (ref) =>
      get(
        `/time-entries/by-task?${new URLSearchParams({
          taskTypeId: ref.taskTypeId,
          title: ref.title,
          ...(ref.link ? { link: ref.link } : {}),
        }).toString()}`,
        z.array(s.timeEntrySchema),
      ),
    updateTask: (ref, input) =>
      send('PUT', '/time-entries/task', z.array(s.timeEntrySchema), {
        ref: {
          taskTypeId: ref.taskTypeId,
          title: ref.title,
          link: ref.link,
        },
        ...input,
      }),
    updateNote: (id, note) =>
      send('PATCH', `/time-entries/${id}/note`, s.timeEntrySchema, { note }),
    finishTask: (ref, finished) =>
      send(
        'POST',
        '/time-entries/task/finish',
        z.object({ updated: z.number() }),
        {
          ref: { taskTypeId: ref.taskTypeId, title: ref.title, link: ref.link },
          finished,
        },
      ),
    search: (q) =>
      get(
        `/time-entries/search?${new URLSearchParams({ q }).toString()}`,
        z.array(
          z.object({
            entry: s.timeEntrySchema,
            workedMinutes: z.number(),
            sessions: z.number(),
            lastDate: z.string(),
            finished: z.boolean(),
            running: z.boolean(),
          }),
        ),
      ),
    searchAll: (q) =>
      get(
        `/time-entries/search/all?${new URLSearchParams({ q }).toString()}`,
        z.array(
          z.object({
            entry: s.timeEntrySchema,
            workedMinutes: z.number(),
            sessions: z.number(),
            lastDate: z.string(),
            finished: z.boolean(),
            running: z.boolean(),
            snippet: z.string().nullable(),
          }),
        ),
      ),
    unfinished: () =>
      get(
        '/time-entries/unfinished',
        z.array(
          z.object({
            entry: s.timeEntrySchema,
            workedMinutes: z.number(),
            sessions: z.number(),
            lastDate: z.string(),
          }),
        ),
      ),
    removeTask: (ref, date) =>
      send(
        'POST',
        '/time-entries/task/delete',
        z.object({ deleted: z.number() }),
        {
          ref: { taskTypeId: ref.taskTypeId, title: ref.title, link: ref.link },
          date,
        },
      ),
    running: () => get('/time-entries/running', s.timeEntrySchema.nullable()),
    start: (input) =>
      send(
        'POST',
        '/time-entries/timer',
        z.object({
          started: s.timeEntrySchema,
          stopped: s.timeEntrySchema.nullable(),
        }),
        input,
      ),
    stop: (id) => send('POST', `/time-entries/${id}/stop`, s.timeEntrySchema),
    pause: (id) => send('POST', `/time-entries/${id}/pause`, s.timeEntrySchema),
    resume: (id) =>
      send(
        'POST',
        `/time-entries/${id}/resume`,
        z.object({
          started: s.timeEntrySchema,
          stopped: s.timeEntrySchema.nullable(),
        }),
      ),
    dismiss: (id) => send('POST', `/time-entries/${id}/dismiss`, emptyResponse),
    paused: () => get('/time-entries/paused', z.array(s.timeEntrySchema)),
  },

  templates: {
    list: () => get('/quick-templates', z.array(s.templateSchema)),
    create: (input) =>
      send('POST', '/quick-templates', s.templateSchema, input),
    update: (id, input) =>
      send('PUT', `/quick-templates/${id}`, s.templateSchema, input),
    reorder: (ids) =>
      send('PUT', '/quick-templates/order', z.array(s.templateSchema), { ids }),
    remove: (id) => send('DELETE', `/quick-templates/${id}`, emptyResponse),
  },
  billing: {
    status: () => get('/billing', s.billingSchema),
    checkout: (plan) =>
      send('POST', '/billing/checkout', z.object({ url: z.url() }), { plan }),
    sync: (sessionId) =>
      send(
        'POST',
        '/billing/sync',
        z.object({ plan: s.planSchema, paid: z.boolean() }),
        { sessionId },
      ),
    portal: () => send('POST', '/billing/portal', z.object({ url: z.url() })),
    invoices: () => get('/billing/invoices', z.array(s.invoiceSchema)),
  },

  admin: {
    stats: () => get('/admin/stats', s.adminStatsSchema),
    users: (filter) =>
      get(
        `/admin/users${queryString({ ...filter, page: filter.page && filter.page > 1 ? filter.page : undefined })}`,
        s.adminUserPageSchema,
      ),
    exportUsers: (filter) =>
      get(
        `/admin/users/export${queryString({ ...filter, page: undefined })}`,
        z.array(s.adminUserSchema),
      ),
    user: (id) => get(`/admin/users/${id}`, s.adminUserDetailSchema),
    updateUser: (id, change) =>
      send('PATCH', `/admin/users/${id}`, s.adminUserSchema, change),
    revokeSessions: (id) =>
      send('POST', `/admin/users/${id}/revoke-sessions`, emptyResponse),
    revokeSession: (id, sessionId) =>
      send('DELETE', `/admin/users/${id}/sessions/${sessionId}`, emptyResponse),
    resendVerification: (id) =>
      send('POST', `/admin/users/${id}/email/verify`, emptyResponse),
    cancelEmailChange: (id) =>
      send('DELETE', `/admin/users/${id}/email/pending`, emptyResponse),
    disableTwoFactor: (id, reason) =>
      send('POST', `/admin/users/${id}/2fa/disable`, emptyResponse, { reason }),
    invoices: (id) =>
      get(`/admin/users/${id}/invoices`, z.array(s.invoiceSchema)),
    deleteUser: (id, confirmEmail) =>
      send('DELETE', `/admin/users/${id}`, emptyResponse, { confirmEmail }),
    actions: (filter) =>
      get(
        `/admin/actions${queryString({ ...filter, page: filter.page && filter.page > 1 ? filter.page : undefined })}`,
        s.adminActionPageSchema,
      ),
  },
}
