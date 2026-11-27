import { z } from 'zod'
import { LIMITS } from '#/domain/rules'

/** Kod usunięcia konta z e-maila: dokładnie 6 cyfr (spacje przy wklejaniu pomijamy). */
export const DELETE_CODE_LENGTH = 6

export const normalizeDeleteCode = (raw: string) =>
  raw.replace(/\D/g, '').slice(0, DELETE_CODE_LENGTH)

export const isDeleteCode = (code: string) =>
  new RegExp(`^\\d{${DELETE_CODE_LENGTH}}$`).test(code)

export const isDisplayName = (name: string) =>
  name.trim().length > 0 && name.length <= LIMITS.displayName

export const isEmail = (email: string) =>
  z.email().safeParse(email.trim()).success

export interface EmailChangeDraft {
  email: string
  password: string
  code: string
}

export const EMPTY_EMAIL_CHANGE: EmailChangeDraft = {
  email: '',
  password: '',
  code: '',
}

/** Dane do API: e-mail bez spacji, puste hasło i kod jako null (konto może ich nie mieć). */
export const emailChangeInput = (draft: EmailChangeDraft) => ({
  email: draft.email.trim(),
  password: draft.password || null,
  code: draft.code.trim() || null,
})
