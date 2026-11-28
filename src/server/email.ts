import type { Locale } from '#/i18n/config'
import { serverEnv } from './env'

interface Email {
  to: string
  subject: string
  text: string
}

/** Lokalnie i w testach (bez Resend): ostatnie e-maile w pamięci, żeby testy mogły kliknąć link. */
export const outbox: Array<Email> = []

/**
 * Wysyłka e-maili transakcyjnych przez Resend (HTTP API). Bez RESEND_API_KEY e-mail trafia
 * do logu serwera, żeby lokalnie dało się kliknąć link z resetu hasła.
 */
export async function sendEmail(email: Email) {
  if (!serverEnv.resendApiKey) {
    // Lokalnie treść (z linkiem) trafia do logu; w produkcji nigdy: linki to klucze do konta.
    if (serverEnv.isProduction)
      console.warn(`[email] RESEND_API_KEY missing, not sent: ${email.subject}`)
    else {
      console.info(`[email] ${email.to}: ${email.subject}\n${email.text}`)
      outbox.push(email)
      const isOutboxFull = outbox.length > 200
      if (isOutboxFull) outbox.shift()
    }
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
    resetSubject: 'Reset your Timeblame password',
    reset: (name: string, link: string) =>
      `Hi ${name},\n\nSomeone (hopefully you) asked to reset the password for your Timeblame account. Open this link within 60 minutes to choose a new one:\n\n${link}\n\nIf it wasn’t you, ignore this email. Your password stays the same.\n\nTimeblame`,
  },
  pl: {
    resetSubject: 'Zmiana hasła w Timeblame',
    reset: (name: string, link: string) =>
      `Cześć ${name},\n\nKtoś (mamy nadzieję, że Ty) poprosił o zmianę hasła do konta w Timeblame. Otwórz ten link w ciągu 60 minut i ustaw nowe hasło:\n\n${link}\n\nJeśli to nie Ty, zignoruj tę wiadomość. Hasło się nie zmieni.\n\nTimeblame`,
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

type Kind =
  | 'verify'
  | 'emailChange'
  | 'emailChangeNotice'
  | 'emailChanged'
  | 'passwordChanged'
  | 'twoFactorOn'
  | 'twoFactorOff'
  | 'accountDeleted'
  | 'reminder'
  | 'deleteCode'
  | 'feedbackReply'
  | 'feedbackNew'

const accountTexts: Record<
  Locale,
  Record<
    Kind,
    { subject: string; body: (variables: Record<string, string>) => string }
  >
> = {
  en: {
    verify: {
      subject: 'Confirm your email for Timeblame',
      body: (variables) =>
        `Hi ${variables.name},\n\nConfirm that this is your email address by opening this link within 24 hours:\n\n${variables.link}\n\nIf you didn’t create a Timeblame account, ignore this email.\n\nTimeblame`,
    },
    emailChange: {
      subject: 'Confirm your new email for Timeblame',
      body: (variables) =>
        `Hi ${variables.name},\n\nYou asked to use this address for your Timeblame account. Open this link within 24 hours to confirm:\n\n${variables.link}\n\nIf it wasn’t you, ignore this email and nothing changes.\n\nTimeblame`,
    },
    emailChangeNotice: {
      subject: 'Your Timeblame email is about to change',
      body: (variables) =>
        `Hi ${variables.name},\n\nSomeone asked to change the email of your Timeblame account to ${variables.email}. It changes only after that address is confirmed.\n\nIf it wasn’t you, change your password now and turn on two-step login: ${variables.link}\n\nTimeblame`,
    },
    emailChanged: {
      subject: 'Your Timeblame email was changed',
      body: (variables) =>
        `Hi ${variables.name},\n\nYour Timeblame account now uses ${variables.email}. This address won’t get emails about the account anymore.\n\nIf it wasn’t you, reply to this email or write to ${variables.support}.\n\nTimeblame`,
    },
    passwordChanged: {
      subject: 'Your Timeblame password was changed',
      body: (variables) =>
        `Hi ${variables.name},\n\nThe password of your Timeblame account was just changed and other devices were signed out.\n\nIf it wasn’t you, reset your password: ${variables.link}\n\nTimeblame`,
    },
    twoFactorOn: {
      subject: 'Two-step login is on',
      body: (variables) =>
        `Hi ${variables.name},\n\nTwo-step login is now on for your Timeblame account. Keep your backup codes somewhere safe.\n\nIf it wasn’t you, reset your password: ${variables.link}\n\nTimeblame`,
    },
    twoFactorOff: {
      subject: 'Two-step login was turned off',
      body: (variables) =>
        `Hi ${variables.name},\n\nTwo-step login was turned off for your Timeblame account.\n\nIf it wasn’t you, reset your password and turn it back on: ${variables.link}\n\nTimeblame`,
    },
    accountDeleted: {
      subject: 'Your Timeblame account was deleted',
      body: (variables) =>
        `Hi ${variables.name},\n\nYour Timeblame account and all its data were deleted, and any subscription was canceled. Thanks for trying Timeblame.\n\nTimeblame`,
    },
    deleteCode: {
      subject: 'Your code to delete your Timeblame account',
      body: (variables) =>
        `Hi ${variables.name},\n\nYour code to delete your Timeblame account is:\n\n${variables.code}\n\nIt works for ${variables.minutes} minutes. Deleting removes all your time entries and settings for good.\n\nIf you didn’t ask for this, ignore this email: your account stays as it is.\n\nTimeblame`,
    },
    feedbackReply: {
      subject: 'Reply to your Timeblame report',
      body: (variables) =>
        `Hi ${variables.name},\n\nYou wrote to us:\n\n> ${variables.message}\n\nOur reply:\n\n${variables.reply}\n\nYou’ll find all your reports and replies in Settings → Help: ${variables.link}\n\nTimeblame`,
    },
    feedbackNew: {
      subject: 'New report in Timeblame: {kind}',
      body: (variables) =>
        `${variables.email} (${variables.plan}) sent a report (${variables.kind}) from ${variables.page}:\n\n${variables.message}\n\nOpen the inbox: ${variables.link}`,
    },
    reminder: {
      subject: 'Log today’s work in Timeblame',
      body: (variables) =>
        `Hi ${variables.name},\n\nSo far today you’ve logged ${variables.logged} of ${variables.target}. Add anything that’s missing while you still remember it:\n\n${variables.link}\n\nYou can change or turn off this reminder in Settings → Workday.\n\nTimeblame`,
    },
  },
  pl: {
    verify: {
      subject: 'Potwierdź adres e-mail w Timeblame',
      body: (variables) =>
        `Cześć ${variables.name},\n\nPotwierdź, że to Twój adres, otwierając ten link w ciągu 24 godzin:\n\n${variables.link}\n\nJeśli nie zakładałeś konta w Timeblame, zignoruj tę wiadomość.\n\nTimeblame`,
    },
    emailChange: {
      subject: 'Potwierdź nowy adres e-mail w Timeblame',
      body: (variables) =>
        `Cześć ${variables.name},\n\nPoprosiłeś o używanie tego adresu w koncie Timeblame. Otwórz ten link w ciągu 24 godzin, żeby to potwierdzić:\n\n${variables.link}\n\nJeśli to nie Ty, zignoruj tę wiadomość. Nic się nie zmieni.\n\nTimeblame`,
    },
    emailChangeNotice: {
      subject: 'Adres e-mail w Timeblame ma się zmienić',
      body: (variables) =>
        `Cześć ${variables.name},\n\nKtoś poprosił o zmianę adresu e-mail Twojego konta w Timeblame na ${variables.email}. Zmiana nastąpi dopiero po potwierdzeniu tego adresu.\n\nJeśli to nie Ty, od razu zmień hasło i włącz logowanie dwuetapowe: ${variables.link}\n\nTimeblame`,
    },
    emailChanged: {
      subject: 'Adres e-mail w Timeblame został zmieniony',
      body: (variables) =>
        `Cześć ${variables.name},\n\nTwoje konto w Timeblame używa teraz adresu ${variables.email}. Na ten adres nie będą już przychodzić wiadomości o koncie.\n\nJeśli to nie Ty, odpowiedz na tę wiadomość albo napisz na ${variables.support}.\n\nTimeblame`,
    },
    passwordChanged: {
      subject: 'Hasło w Timeblame zostało zmienione',
      body: (variables) =>
        `Cześć ${variables.name},\n\nHasło do Twojego konta w Timeblame zostało właśnie zmienione, a inne urządzenia wylogowane.\n\nJeśli to nie Ty, ustaw nowe hasło: ${variables.link}\n\nTimeblame`,
    },
    twoFactorOn: {
      subject: 'Logowanie dwuetapowe jest włączone',
      body: (variables) =>
        `Cześć ${variables.name},\n\nLogowanie dwuetapowe jest włączone dla Twojego konta w Timeblame. Przechowuj kody zapasowe w bezpiecznym miejscu.\n\nJeśli to nie Ty, ustaw nowe hasło: ${variables.link}\n\nTimeblame`,
    },
    twoFactorOff: {
      subject: 'Logowanie dwuetapowe zostało wyłączone',
      body: (variables) =>
        `Cześć ${variables.name},\n\nLogowanie dwuetapowe zostało wyłączone dla Twojego konta w Timeblame.\n\nJeśli to nie Ty, ustaw nowe hasło i włącz je ponownie: ${variables.link}\n\nTimeblame`,
    },
    accountDeleted: {
      subject: 'Konto w Timeblame zostało usunięte',
      body: (variables) =>
        `Cześć ${variables.name},\n\nTwoje konto w Timeblame i wszystkie jego dane zostały usunięte, a subskrypcja anulowana. Dzięki, że wypróbowałeś Timeblame.\n\nTimeblame`,
    },
    deleteCode: {
      subject: 'Kod do usunięcia konta w Timeblame',
      body: (variables) =>
        `Cześć ${variables.name},\n\nTwój kod do usunięcia konta w Timeblame:\n\n${variables.code}\n\nDziała przez ${variables.minutes} minut. Usunięcie kasuje na zawsze wszystkie wpisy czasu i ustawienia.\n\nJeśli to nie Ty, zignoruj tę wiadomość: konto zostaje bez zmian.\n\nTimeblame`,
    },
    feedbackReply: {
      subject: 'Odpowiedź na Twoje zgłoszenie w Timeblame',
      body: (variables) =>
        `Cześć ${variables.name},\n\nNapisałeś do nas:\n\n> ${variables.message}\n\nNasza odpowiedź:\n\n${variables.reply}\n\nWszystkie zgłoszenia i odpowiedzi znajdziesz w Ustawienia → Pomoc: ${variables.link}\n\nTimeblame`,
    },
    feedbackNew: {
      subject: 'Nowe zgłoszenie w Timeblame: {kind}',
      body: (variables) =>
        `${variables.email} (${variables.plan}) wysłał zgłoszenie (${variables.kind}) ze strony ${variables.page}:\n\n${variables.message}\n\nSkrzynka zgłoszeń: ${variables.link}`,
    },
    reminder: {
      subject: 'Wpisz dzisiejszą pracę w Timeblame',
      body: (variables) =>
        `Cześć ${variables.name},\n\nDziś masz wpisane ${variables.logged} z ${variables.target}. Dopisz brakujące rzeczy, póki pamiętasz:\n\n${variables.link}\n\nPrzypomnienie zmienisz albo wyłączysz w Ustawienia → Dzień pracy.\n\nTimeblame`,
    },
  },
}

/** E-mail o koncie w języku użytkownika; `vars` wypełnia treść (imię, link, adres…). */
export function accountEmail(
  kind: Kind,
  locale: Locale,
  to: string,
  variables: Record<string, string>,
): Email {
  const text = accountTexts[locale][kind]
  return {
    to,
    subject: text.subject.replace(
      /\{(\w+)\}/g,
      (_unused, key: string) => variables[key] ?? '',
    ),
    text: text.body(variables),
  }
}
