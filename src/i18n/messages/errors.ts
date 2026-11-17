import type { Dictionary } from '../context'

/** Komunikaty dla stabilnych kodów błędów z API (ApiFailure.code). */
const en = {
  'network.unreachable':
    'Can’t reach the server. Check your connection and try again.',
  'auth.invalid_credentials': 'That username or password isn’t right.',
  'auth.username_taken': 'This username is already taken.',
  'auth.email_taken': 'An account with this email already exists.',
  'auth.no_session': 'Your session has ended. Log in again.',
  'auth.wrong_password': 'Your current password isn’t right.',
  'auth.too_many_attempts':
    'Too many attempts. Wait a few minutes and try again.',
  'auth.reset_invalid':
    'This reset link has expired or was already used. Ask for a new one.',
  'auth.google_unavailable':
    'Signing in with Google isn’t available right now.',
  'auth.google_failed': 'We couldn’t sign you in with Google. Try again.',
  'auth.account_disabled':
    'This account has been blocked. Contact support if you think it’s a mistake.',
  'auth.forbidden': 'You don’t have access to this page.',
  'demo.restricted':
    'This isn’t available in the demo. Create a free account to use it.',
  'demo.unavailable':
    'The demo is busy right now. Try again in a few minutes or create a free account.',
  'admin.self': 'You can’t do this to your own account.',
  'admin.owner':
    'This is an owner account (ADMIN_EMAILS). It can’t be blocked, deleted or lose admin rights.',
  'admin.last_admin': 'This is the last administrator. Add another one first.',
  'billing.unavailable': 'Payments aren’t switched on yet. Try again later.',
  'billing.already_subscribed':
    'You already have this plan. Manage it in Settings → Plan.',
  'billing.failed':
    'We couldn’t reach the payment provider. Try again in a moment.',
  name_taken: 'You already have one with this name.',
  key_taken: 'Another project already uses this key.',
  hotkey_taken: 'Another template already uses this shortcut.',
  'plan.limit_custom_types':
    'The Free plan includes up to 3 custom work types. Archive one or upgrade to Pro.',
  'plan.limit_history':
    'On the Free plan you can add entries from the last 30 days. Upgrade to Pro to log older work.',
  'break.running': 'A break is already running. End it first.',
  'status.default_archive':
    'The default status can’t be archived. Make another status the default first.',
  'status.system_archive': 'Built-in statuses can be renamed but not archived.',
  'status.last_in_category': 'Keep at least one active status in each group.',
  'type.system_archive': 'Built-in work types can be edited but not archived.',
  'type.unknown': 'Choose an existing work type.',
  'sprint.overlap': 'These dates overlap another sprint.',
  'sprint.dates': 'The end date can’t be before the start date.',
  'scale.invalid': 'Check the highlighted rows in the scale.',
  'sprint.cadence_delete':
    'Sprints from your schedule can’t be deleted. Edit it, or change the schedule instead.',
  'validation.invalid': 'Check the highlighted fields.',
  not_found: 'This item no longer exists. Refresh the page.',
  'server.unexpected': 'Something went wrong on our side. Try again.',
}

export type ErrorMessages = Record<keyof typeof en, string>

const pl: ErrorMessages = {
  'network.unreachable':
    'Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.',
  'auth.invalid_credentials': 'Nieprawidłowy login lub hasło.',
  'auth.username_taken': 'Ten login jest już zajęty.',
  'auth.email_taken': 'Konto z tym adresem e-mail już istnieje.',
  'auth.no_session': 'Sesja wygasła. Zaloguj się ponownie.',
  'auth.wrong_password': 'Obecne hasło jest nieprawidłowe.',
  'auth.too_many_attempts':
    'Za dużo prób. Odczekaj kilka minut i spróbuj ponownie.',
  'auth.reset_invalid': 'Ten link wygasł albo został już użyty. Poproś o nowy.',
  'auth.google_unavailable': 'Logowanie przez Google jest teraz niedostępne.',
  'auth.google_failed':
    'Nie udało się zalogować przez Google. Spróbuj ponownie.',
  'auth.account_disabled':
    'To konto zostało zablokowane. Jeśli to pomyłka, napisz do nas.',
  'auth.forbidden': 'Nie masz dostępu do tej strony.',
  'demo.restricted':
    'To nie działa w wersji demo. Załóż darmowe konto, żeby z tego korzystać.',
  'demo.unavailable':
    'Demo jest teraz zajęte. Spróbuj za kilka minut albo załóż darmowe konto.',
  'admin.self': 'Nie możesz zrobić tego na własnym koncie.',
  'admin.owner':
    'To konto właściciela (ADMIN_EMAILS). Nie da się go zablokować, usunąć ani odebrać mu roli admina.',
  'admin.last_admin': 'To ostatni administrator. Najpierw dodaj kolejnego.',
  'billing.unavailable': 'Płatności nie są jeszcze włączone. Spróbuj później.',
  'billing.already_subscribed':
    'Masz już ten plan. Zarządzasz nim w Ustawienia → Plan.',
  'billing.failed':
    'Nie udało się połączyć z operatorem płatności. Spróbuj za chwilę.',
  name_taken: 'Masz już element o tej nazwie.',
  key_taken: 'Ten klucz ma już inny projekt.',
  hotkey_taken: 'Ten skrót ma już inny szablon.',
  'plan.limit_custom_types':
    'Plan Free obejmuje do 3 własnych typów pracy. Zarchiwizuj jeden albo przejdź na Pro.',
  'plan.limit_history':
    'W planie Free dodasz wpisy z ostatnich 30 dni. Przejdź na Pro, żeby wpisać starszą pracę.',
  'break.running': 'Przerwa już trwa. Najpierw ją zakończ.',
  'status.default_archive':
    'Nie można zarchiwizować statusu domyślnego. Najpierw ustaw inny jako domyślny.',
  'status.system_archive':
    'Wbudowane statusy można edytować, ale nie archiwizować.',
  'status.last_in_category':
    'Zostaw przynajmniej jeden aktywny status w każdej grupie.',
  'type.system_archive':
    'Wbudowane typy pracy można edytować, ale nie archiwizować.',
  'type.unknown': 'Wybierz istniejący typ pracy.',
  'sprint.overlap': 'Te daty nachodzą na inny sprint.',
  'sprint.dates': 'Data końca nie może być wcześniejsza niż data startu.',
  'scale.invalid': 'Popraw zaznaczone wiersze skali.',
  'sprint.cadence_delete':
    'Sprintów z harmonogramu nie można usunąć. Edytuj sprint albo zmień harmonogram.',
  'validation.invalid': 'Popraw zaznaczone pola.',
  not_found: 'Ten element już nie istnieje. Odśwież stronę.',
  'server.unexpected':
    'Coś poszło nie tak po naszej stronie. Spróbuj ponownie.',
}

export const errorMessages: Dictionary<ErrorMessages> = { en, pl }

export type ErrorCode = keyof ErrorMessages

export const isKnownError = (code: string): code is ErrorCode => code in en
