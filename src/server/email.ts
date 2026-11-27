import type { Locale } from '#/i18n/config'
import { serverEnv } from './env'

interface Email {
  to: string
  subject: string
  text: string
}

/**
 * Wysyłka e-maili transakcyjnych przez Resend (HTTP API). Bez RESEND_API_KEY e-mail trafia
 * do logu serwera, żeby lokalnie dało się kliknąć link z resetu hasła.
 */
export async function sendEmail(email: Email) {
  if (!serverEnv.resendApiKey) {
    console.info(`[email] ${email.to}: ${email.subject}\n${email.text}`)
    return
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serverEnv.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: serverEnv.emailFrom, ...email }),
  })
  if (!response.ok)
    console.error(`[email] Resend ${response.status}: ${await response.text()}`)
}

const texts = {
  en: {
    resetSubject: 'Reset your Pointhours password',
    reset: (name: string, link: string) =>
      `Hi ${name},\n\nSomeone (hopefully you) asked to reset the password for your Pointhours account. Open this link within 60 minutes to choose a new one:\n\n${link}\n\nIf it wasn’t you, ignore this email. Your password stays the same.\n\nPointhours`,
  },
  pl: {
    resetSubject: 'Zmiana hasła w Pointhours',
    reset: (name: string, link: string) =>
      `Cześć ${name},\n\nKtoś (mamy nadzieję, że Ty) poprosił o zmianę hasła do konta w Pointhours. Otwórz ten link w ciągu 60 minut i ustaw nowe hasło:\n\n${link}\n\nJeśli to nie Ty, zignoruj tę wiadomość. Hasło się nie zmieni.\n\nPointhours`,
  },
} satisfies Record<Locale, unknown>

export function passwordResetEmail(
  locale: Locale,
  to: string,
  name: string,
  link: string,
): Email {
  return {
    to,
    subject: texts[locale].resetSubject,
    text: texts[locale].reset(name, link),
  }
}
