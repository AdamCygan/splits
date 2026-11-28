import { describe, expect, it, vi } from 'vitest'
import {
  buildCommands,
  matchesWords,
  orderResults,
  queryWords,
  typedCommands,
} from '../../src/features/commands/controllers/commands'
import type { PaletteContext } from '../../src/features/commands/controllers/commands'
import { appMessages } from '#/i18n/messages/app'
import { settingsMessages } from '#/i18n/messages/settings'

const ctx = (patch: Partial<PaletteContext> = {}): PaletteContext => ({
  text: appMessages.en,
  settingsText: settingsMessages.en,
  feedbackLabel: 'Report a problem or idea',
  locale: 'en',
  today: '2026-11-26',
  isPro: false,
  workspaces: {
    items: [
      { id: 'w1', name: 'Acme', shortcut: 'Alt+Shift+1' },
      { id: 'w2', name: 'Globex', shortcut: 'Alt+Shift+2' },
    ],
    currentId: 'w1',
    switchLabel: 'Switch to {name}',
    createLabel: 'New workspace',
  },
  running: null,
  paused: [],
  runningBreak: null,
  templates: [],
  currentSprint: undefined,
  typeOf: () => undefined,
  formatMinutes: (m) => `${m}m`,
  formatDay: (d) => d,
  actions: {
    go: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    resume: vi.fn(),
    startBreak: vi.fn(),
    endBreak: vi.fn(),
    setTheme: vi.fn(),
    setClock: vi.fn(),
    setLocale: vi.fn(),
    signOut: vi.fn(),
    showShortcuts: vi.fn(),
    switchWorkspace: vi.fn(),
    newWorkspace: vi.fn(),
  },
  ...patch,
})

const search = (c: PaletteContext, typed: string) =>
  orderResults([
    ...buildCommands(c).filter((cmd) => matchesWords(cmd, queryWords(typed))),
    ...typedCommands(c, typed),
  ]).map((x) => x.id)

describe('command palette model', () => {
  it('Should show only everyday commands without a query', () => {
    const ids = search(ctx(), '')
    expect(ids).toContain('log')
    expect(ids).toContain('p-today')
    expect(ids).not.toContain('logout')
  })

  it('Should understand meaning in both languages and diacritics', () => {
    expect(search(ctx(), 'create task')[0]).toBe('log')
    expect(search(ctx(), 'dodaj zadanie')[0]).toBe('log')
    expect(search(ctx(), 'urlop')).toContain('day-off')
    expect(search(ctx(), 'wyloguj')).toContain('logout')
  })

  it('Should switch to another workspace by name or by the word workspace', () => {
    const c = ctx()
    expect(search(c, 'globex')).toContain('ws-w2')
    expect(search(c, 'przestrzen')).toEqual(
      expect.arrayContaining(['ws-w2', 'ws-new']),
    )
    // Bieżącej przestrzeni nie ma na liście.
    expect(search(c, 'acme')).not.toContain('ws-w1')
    buildCommands(c)
      .find((x) => x.id === 'ws-w2')!
      .run()
    expect(c.actions.switchWorkspace).toHaveBeenCalledWith('w2')
  })

  it('Should put typed-text commands last and turn dates into days', () => {
    const ids = search(ctx(), '20.11')
    expect(ids.slice(0, 2)).toEqual(['date-log', 'date-open'])
    expect(ids.slice(-2)).toEqual(['log-titled', 'timer-titled'])
  })

  it('Should run actions through the context', () => {
    const c = ctx()
    buildCommands(c)
      .find((x) => x.id === 'upgrade')!
      .run()
    expect(c.actions.go).toHaveBeenCalledWith('/app/settings/plan', undefined)
    expect(
      buildCommands(ctx({ isPro: true })).some((x) => x.id === 'upgrade'),
    ).toBe(false)
  })
})
