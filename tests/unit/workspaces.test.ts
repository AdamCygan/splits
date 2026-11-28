import { describe, expect, it } from 'vitest'
import {
  copyNeeds,
  resolveApply,
  shouldAskToday,
  uniqueName,
  workspaceForDigit,
  workspaceShortcut,
} from '#/features/workspaces/domain/workspaces'

describe('shouldAskToday', () => {
  const base = {
    workspaceCount: 2,
    askDaily: true,
    pickedOn: '2026-11-27',
    today: '2026-11-28',
  }

  it('Should ask on the first visit of the day when there are several workspaces', () => {
    expect(shouldAskToday(base)).toBe(true)
    expect(shouldAskToday({ ...base, pickedOn: null })).toBe(true)
  })

  it('Should not ask again the same day, with one workspace or when turned off', () => {
    expect(shouldAskToday({ ...base, pickedOn: '2026-11-28' })).toBe(false)
    expect(shouldAskToday({ ...base, workspaceCount: 1 })).toBe(false)
    expect(shouldAskToday({ ...base, askDaily: false })).toBe(false)
  })
})

describe('resolveApply', () => {
  it('Should change only the current workspace when there is just one', () => {
    expect(resolveApply({ tags: 'all' }, 'tags', 1)).toBe('this')
  })

  it('Should follow the saved choice and return null when it has to ask', () => {
    expect(resolveApply({ tags: 'all' }, 'tags', 2)).toBe('all')
    expect(resolveApply({ tags: 'this' }, 'tags', 3)).toBe('this')
    expect(resolveApply({}, 'tags', 2)).toBeNull()
    expect(resolveApply({ tags: 'ask' }, 'tags', 2)).toBeNull()
  })
})

describe('workspace shortcuts', () => {
  it('Should give Alt+Shift+1…9 to the first nine workspaces only', () => {
    expect(workspaceShortcut(0)).toBe('Alt+Shift+1')
    expect(workspaceShortcut(8)).toBe('Alt+Shift+9')
    expect(workspaceShortcut(9)).toBeNull()
    expect(workspaceShortcut(-1)).toBeNull()
  })

  it('Should find the workspace for a digit', () => {
    const list = ['a', 'b']
    expect(workspaceForDigit(list, 2)).toBe('b')
    expect(workspaceForDigit(list, 3)).toBeNull()
    expect(workspaceForDigit(list, 0)).toBeNull()
  })
})

describe('copying between workspaces', () => {
  it('Should bring work types along with templates', () => {
    expect(copyNeeds(['templates'])).toEqual(['templates', 'workTypes'])
    expect(copyNeeds(['templates', 'workTypes'])).toEqual([
      'templates',
      'workTypes',
    ])
    expect(copyNeeds(['tags'])).toEqual(['tags'])
  })

  it('Should name a copy uniquely within the 40-character limit', () => {
    expect(uniqueName('Acme', ['Other'])).toBe('Acme')
    expect(uniqueName('Acme', ['acme'])).toBe('Acme (2)')
    expect(uniqueName('Acme', ['Acme', 'Acme (2)'])).toBe('Acme (3)')
    const long = 'x'.repeat(40)
    const copy = uniqueName(long, [long])
    expect(copy).toHaveLength(40)
    expect(copy.endsWith(' (2)')).toBe(true)
  })
})
