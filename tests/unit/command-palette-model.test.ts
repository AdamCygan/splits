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

const context = (patch: Partial<PaletteContext> = {}): PaletteContext => ({
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
  formatMinutes: (minutes) => `${minutes}m`,
  formatDay: (isoDate) => isoDate,
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

const search = (paletteContext: PaletteContext, typed: string) =>
  orderResults([
    ...buildCommands(paletteContext).filter((command) =>
      matchesWords(command, queryWords(typed)),
    ),
    ...typedCommands(paletteContext, typed),
  ]).map((command) => command.id)

describe('command palette model', () => {
  it('Should show only everyday commands without a query', () => {
    const ids = search(context(), '')
    expect(ids).toContain('log')
    expect(ids).toContain('p-today')
    expect(ids).not.toContain('logout')
  })

  it('Should understand meaning in both languages and diacritics', () => {
    expect(search(context(), 'create task')[0]).toBe('log')
    expect(search(context(), 'dodaj zadanie')[0]).toBe('log')
    expect(search(context(), 'urlop')).toContain('day-off')
    expect(search(context(), 'wyloguj')).toContain('logout')
  })

  it('Should switch to another workspace by name or by the word workspace', () => {
    const paletteContext = context()
    expect(search(paletteContext, 'globex')).toContain('ws-w2')
    expect(search(paletteContext, 'przestrzen')).toEqual(
      expect.arrayContaining(['ws-w2', 'ws-new']),
    )
    // Bieżącej przestrzeni nie ma na liście.
    expect(search(paletteContext, 'acme')).not.toContain('ws-w1')
    buildCommands(paletteContext)
      .find((command) => command.id === 'ws-w2')!
      .run()
    expect(paletteContext.actions.switchWorkspace).toHaveBeenCalledWith('w2')
  })

  it('Should put typed-text commands last and turn dates into days', () => {
    const ids = search(context(), '20.11')
    expect(ids.slice(0, 2)).toEqual(['date-log', 'date-open'])
    expect(ids.slice(-2)).toEqual(['log-titled', 'timer-titled'])
  })

  it('Should run actions through the context', () => {
    const paletteContext = context()
    buildCommands(paletteContext)
      .find((command) => command.id === 'upgrade')!
      .run()
    expect(paletteContext.actions.go).toHaveBeenCalledWith(
      '/app/settings/plan',
      undefined,
    )
    expect(
      buildCommands(context({ isPro: true })).some(
        (command) => command.id === 'upgrade',
      ),
    ).toBe(false)
  })
})
