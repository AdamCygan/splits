/** Rodzaj zgłoszenia z aplikacji. */
export const FEEDBACK_KINDS = ['bug', 'idea', 'question'] as const
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number]

/** Stan zgłoszenia: nowe → w toku → zrobione albo odrzucone. */
export const FEEDBACK_STATUSES = [
  'new',
  'in_progress',
  'done',
  'dismissed',
] as const
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number]

export const FEEDBACK_MESSAGE = { min: 5, max: 4000 } as const
export const FEEDBACK_REPLY_MAX = 4000

/** Zgłoszenie czeka na reakcję (nowe albo w toku). */
export const isOpenFeedback = (status: FeedbackStatus) =>
  status === 'new' || status === 'in_progress'

/**
 * Strona, z której przyszło zgłoszenie: sama ścieżka, bez parametrów i fragmentu
 * (w adresie bywają tokeny, np. reset hasła czy potwierdzenie e-maila).
 */
export const feedbackPage = (path: string) =>
  (path.split(/[?#]/)[0] ?? '').slice(0, 300) || '/'

/** Przeglądarka i system skrócone do rozsądnej długości (do odtworzenia błędu). */
export const feedbackUserAgent = (userAgent: string) =>
  userAgent.trim().slice(0, 300)

export type FeedbackMessageError = 'tooShort' | 'tooLong'

/** Treść zgłoszenia: po przycięciu spacji 5–4000 znaków. */
export function feedbackMessageError(
  message: string,
): FeedbackMessageError | null {
  const length = message.trim().length
  const isTooShort = length < FEEDBACK_MESSAGE.min
  if (isTooShort) return 'tooShort'
  const isTooLong = length > FEEDBACK_MESSAGE.max
  if (isTooLong) return 'tooLong'
  return null
}

const BROWSER_NAMES: Readonly<Record<string, string>> = {
  Edg: 'Edge',
  OPR: 'Opera',
}

/** Krótki opis przeglądarki do podglądu przed wysłaniem (np. „Chrome 131, Windows”). */
export function browserLabel(userAgent: string) {
  // Edge i Opera podają też „Chrome/…”, więc sprawdzamy je najpierw.
  const browser = ['Edg', 'OPR', 'Firefox', 'Chrome', 'Safari']
    .map((name) => new RegExp(`(${name})/(\\d+)`).exec(userAgent))
    .find(Boolean)
  const operatingSystem = /Windows|Mac OS X|Android|iPhone|iPad|Linux/
    .exec(userAgent)?.[0]
    ?.replace('Mac OS X', 'macOS')
  const name = browser
    ? `${BROWSER_NAMES[browser[1]!] ?? browser[1]} ${browser[2]}`
    : null
  return (
    [name, operatingSystem].filter(Boolean).join(', ') || userAgent.slice(0, 40)
  )
}
