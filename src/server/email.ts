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
      if (outbox.length > 200) outbox.shift()
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

const accountTexts: Record<
  Locale,
  Record<Kind, { subject: string; body: (v: Record<string, string>) => string }>
> = {
  en: {
    verify: {
      subject: 'Confirm your email for Pointhours',
      body: (v) =>
        `Hi ${v.name},\n\nConfirm that this is your email address by opening this link within 24 hours:\n\n${v.link}\n\nIf you didn’t create a Pointhours account, ignore this email.\n\nPointhours`,
    },
    emailChange: {
      subject: 'Confirm your new email for Pointhours',
      body: (v) =>
        `Hi ${v.name},\n\nYou asked to use this address for your Pointhours account. Open this link within 24 hours to confirm:\n\n${v.link}\n\nIf it wasn’t you, ignore this email and nothing changes.\n\nPointhours`,
    },
    emailChangeNotice: {
      subject: 'Your Pointhours email is about to change',
      body: (v) =>
        `Hi ${v.name},\n\nSomeone asked to change the email of your Pointhours account to ${v.email}. It changes only after that address is confirmed.\n\nIf it wasn’t you, change your password now and turn on two-step login: ${v.link}\n\nPointhours`,
    },
    emailChanged: {
      subject: 'Your Pointhours email was changed',
      body: (v) =>
        `Hi ${v.name},\n\nYour Pointhours account now uses ${v.email}. This address won’t get emails about the account anymore.\n\nIf it wasn’t you, reply to this email or write to ${v.support}.\n\nPointhours`,
    },
    passwordChanged: {
      subject: 'Your Pointhours password was changed',
      body: (v) =>
        `Hi ${v.name},\n\nThe password of your Pointhours account was just changed and other devices were signed out.\n\nIf it wasn’t you, reset your password: ${v.link}\n\nPointhours`,
    },
    twoFactorOn: {
      subject: 'Two-step login is on',
      body: (v) =>
        `Hi ${v.name},\n\nTwo-step login is now on for your Pointhours account. Keep your backup codes somewhere safe.\n\nIf it wasn’t you, reset your password: ${v.link}\n\nPointhours`,
    },
    twoFactorOff: {
      subject: 'Two-step login was turned off',
      body: (v) =>
        `Hi ${v.name},\n\nTwo-step login was turned off for your Pointhours account.\n\nIf it wasn’t you, reset your password and turn it back on: ${v.link}\n\nPointhours`,
    },
    accountDeleted: {
      subject: 'Your Pointhours account was deleted',
      body: (v) =>
        `Hi ${v.name},\n\nYour Pointhours account and all its data were deleted, and any subscription was canceled. Thanks for trying Pointhours.\n\nPointhours`,
    },
    deleteCode: {
      subject: 'Your code to delete your Pointhours account',
      body: (v) =>
        `Hi ${v.name},\n\nYour code to delete your Pointhours account is:\n\n${v.code}\n\nIt works for ${v.minutes} minutes. Deleting removes all your time entries and settings for good.\n\nIf you didn’t ask for this, ignore this email: your account stays as it is.\n\nPointhours`,
    },
    reminder: {
      subject: 'Log today’s work in Pointhours',
      body: (v) =>
        `Hi ${v.name},\n\nSo far today you’ve logged ${v.logged} of ${v.target}. Add anything that’s missing while you still remember it:\n\n${v.link}\n\nYou can change or turn off this reminder in Settings → Workday.\n\nPointhours`,
    },
  },
  pl: {
    verify: {
      subject: 'Potwierdź adres e-mail w Pointhours',
      body: (v) =>
        `Cześć ${v.name},\n\nPotwierdź, że to Twój adres, otwierając ten link w ciągu 24 godzin:\n\n${v.link}\n\nJeśli nie zakładałeś konta w Pointhours, zignoruj tę wiadomość.\n\nPointhours`,
    },
    emailChange: {
      subject: 'Potwierdź nowy adres e-mail w Pointhours',
      body: (v) =>
        `Cześć ${v.name},\n\nPoprosiłeś o używanie tego adresu w koncie Pointhours. Otwórz ten link w ciągu 24 godzin, żeby to potwierdzić:\n\n${v.link}\n\nJeśli to nie Ty, zignoruj tę wiadomość. Nic się nie zmieni.\n\nPointhours`,
    },
    emailChangeNotice: {
      subject: 'Adres e-mail w Pointhours ma się zmienić',
      body: (v) =>
        `Cześć ${v.name},\n\nKtoś poprosił o zmianę adresu e-mail Twojego konta w Pointhours na ${v.email}. Zmiana nastąpi dopiero po potwierdzeniu tego adresu.\n\nJeśli to nie Ty, od razu zmień hasło i włącz logowanie dwuetapowe: ${v.link}\n\nPointhours`,
    },
    emailChanged: {
      subject: 'Adres e-mail w Pointhours został zmieniony',
      body: (v) =>
        `Cześć ${v.name},\n\nTwoje konto w Pointhours używa teraz adresu ${v.email}. Na ten adres nie będą już przychodzić wiadomości o koncie.\n\nJeśli to nie Ty, odpowiedz na tę wiadomość albo napisz na ${v.support}.\n\nPointhours`,
    },
    passwordChanged: {
      subject: 'Hasło w Pointhours zostało zmienione',
      body: (v) =>
        `Cześć ${v.name},\n\nHasło do Twojego konta w Pointhours zostało właśnie zmienione, a inne urządzenia wylogowane.\n\nJeśli to nie Ty, ustaw nowe hasło: ${v.link}\n\nPointhours`,
    },
    twoFactorOn: {
      subject: 'Logowanie dwuetapowe jest włączone',
      body: (v) =>
        `Cześć ${v.name},\n\nLogowanie dwuetapowe jest włączone dla Twojego konta w Pointhours. Przechowuj kody zapasowe w bezpiecznym miejscu.\n\nJeśli to nie Ty, ustaw nowe hasło: ${v.link}\n\nPointhours`,
    },
    twoFactorOff: {
      subject: 'Logowanie dwuetapowe zostało wyłączone',
      body: (v) =>
        `Cześć ${v.name},\n\nLogowanie dwuetapowe zostało wyłączone dla Twojego konta w Pointhours.\n\nJeśli to nie Ty, ustaw nowe hasło i włącz je ponownie: ${v.link}\n\nPointhours`,
    },
    accountDeleted: {
      subject: 'Konto w Pointhours zostało usunięte',
      body: (v) =>
        `Cześć ${v.name},\n\nTwoje konto w Pointhours i wszystkie jego dane zostały usunięte, a subskrypcja anulowana. Dzięki, że wypróbowałeś Pointhours.\n\nPointhours`,
    },
    deleteCode: {
      subject: 'Kod do usunięcia konta w Pointhours',
      body: (v) =>
        `Cześć ${v.name},\n\nTwój kod do usunięcia konta w Pointhours:\n\n${v.code}\n\nDziała przez ${v.minutes} minut. Usunięcie kasuje na zawsze wszystkie wpisy czasu i ustawienia.\n\nJeśli to nie Ty, zignoruj tę wiadomość: konto zostaje bez zmian.\n\nPointhours`,
    },
    reminder: {
      subject: 'Wpisz dzisiejszą pracę w Pointhours',
      body: (v) =>
        `Cześć ${v.name},\n\nDziś masz wpisane ${v.logged} z ${v.target}. Dopisz brakujące rzeczy, póki pamiętasz:\n\n${v.link}\n\nPrzypomnienie zmienisz albo wyłączysz w Ustawienia → Dzień pracy.\n\nPointhours`,
    },
  },
}

/** E-mail o koncie w języku użytkownika; `vars` wypełnia treść (imię, link, adres…). */
export function accountEmail(
  kind: Kind,
  locale: Locale,
  to: string,
  vars: Record<string, string>,
): Email {
  const text = accountTexts[locale][kind]
  return { to, subject: text.subject, text: text.body(vars) }
}
