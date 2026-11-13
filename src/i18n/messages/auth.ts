import type { Dictionary } from '../context'

const en = {
  aside: 'Every hour of the sprint in its place.',
  or: 'or',
  google: 'Continue with Google',
  googleError:
    'We couldn’t sign you in with Google. Try again or use your email.',
  googleUnavailable:
    'Signing in with Google isn’t set up yet. Use your email instead.',
  login: {
    seoTitle: 'Log in | Splits',
    title: 'Log in',
    noAccount: 'No account yet?',
    createOne: 'Create one for free',
    loginLabel: 'Username or email',
    password: 'Password',
    forgot: 'Forgot your password?',
    submit: 'Log in',
    submitting: 'Logging in…',
  },
  register: {
    seoTitle: 'Create a free account | Splits',
    seoDescription:
      'Create a free Splits account and start logging time on tasks, code reviews and meetings. No credit card needed.',
    title: 'Create your account',
    haveAccount: 'Already have an account?',
    logIn: 'Log in',
    username: 'Username',
    usernameHint: 'You’ll use it to log in, for example adam.dev',
    email: 'Email',
    password: 'Password',
    passwordHint: 'At least 10 characters, including a letter and a number.',
    terms: 'I accept the {terms} and the {privacy}.',
    termsLink: 'Terms of Service',
    privacyLink: 'Privacy Policy',
    submit: 'Create account',
    submitting: 'Creating account…',
    planNote: {
      pro: 'You picked Pro (yearly). Create your account first and we’ll take you straight to your cart and a secure Stripe checkout.',
    },
  },
  forgot: {
    seoTitle: 'Reset your password | Splits',
    title: 'Reset your password',
    lead: 'Enter the email for your account and we’ll send you a link to set a new password.',
    email: 'Email',
    submit: 'Send link',
    submitting: 'Sending…',
    sentTitle: 'Check your inbox',
    sentText:
      'If an account with {email} exists, we’ve sent it a link to set a new password. The link is valid for one hour.',
    back: 'Back to log in',
  },
  reset: {
    seoTitle: 'Choose a new password | Splits',
    title: 'Choose a new password',
    lead: 'Pick a password you don’t use anywhere else.',
    password: 'New password',
    confirm: 'Repeat the new password',
    confirmError: 'The passwords don’t match.',
    submit: 'Save new password',
    submitting: 'Saving…',
    done: 'Password changed. Log in with your new password.',
    missing:
      'This link is incomplete. Open the link from the email again, or ask for a new one.',
    again: 'Ask for a new link',
  },
  validation: {
    loginRequired: 'Enter your username or email.',
    passwordRequired: 'Enter your password.',
    username:
      'Use 3–30 characters: letters, numbers, dots, hyphens or underscores. Start with a letter or number.',
    email: 'Enter a valid email address.',
    passwordMin: 'Use at least {min} characters.',
    passwordMax: 'Use at most {max} characters.',
    passwordLetter: 'Include at least one letter.',
    passwordDigit: 'Include at least one number.',
    terms: 'Accept the terms to create an account.',
  },
}

export type AuthMessages = typeof en

const pl: AuthMessages = {
  aside: 'Każda godzina sprintu na swoim miejscu.',
  google: 'Kontynuuj z Google',
  googleError:
    'Nie udało się zalogować przez Google. Spróbuj ponownie albo użyj e-maila.',
  googleUnavailable:
    'Logowanie przez Google nie jest jeszcze włączone. Użyj e-maila.',
  or: 'albo',
  login: {
    seoTitle: 'Logowanie | Splits',
    title: 'Zaloguj się',
    noAccount: 'Nie masz konta?',
    createOne: 'Załóż je za darmo',
    loginLabel: 'Login lub e-mail',
    password: 'Hasło',
    forgot: 'Nie pamiętasz hasła?',
    submit: 'Zaloguj się',
    submitting: 'Logowanie…',
  },
  register: {
    seoTitle: 'Załóż darmowe konto | Splits',
    seoDescription:
      'Załóż darmowe konto Splits i zacznij notować czas pracy na zadaniach, Code Review i spotkaniach. Bez karty.',
    title: 'Załóż konto',
    haveAccount: 'Masz już konto?',
    logIn: 'Zaloguj się',
    username: 'Login',
    usernameHint: 'Tym loginem będziesz się logować, np. adam.dev',
    email: 'E-mail',
    password: 'Hasło',
    passwordHint: 'Co najmniej 10 znaków, w tym litera i cyfra.',
    terms: 'Akceptuję {terms} i {privacy}.',
    termsLink: 'regulamin',
    privacyLink: 'politykę prywatności',
    submit: 'Załóż konto',
    submitting: 'Zakładanie konta…',
    planNote: {
      pro: 'Wybrałeś Pro (rocznie). Najpierw załóż konto, a od razu przejdziesz do koszyka i bezpiecznej płatności Stripe.',
    },
  },
  forgot: {
    seoTitle: 'Reset hasła | Splits',
    title: 'Reset hasła',
    lead: 'Podaj e-mail konta, a wyślemy link do ustawienia nowego hasła.',
    email: 'E-mail',
    submit: 'Wyślij link',
    submitting: 'Wysyłanie…',
    sentTitle: 'Sprawdź skrzynkę',
    sentText:
      'Jeśli konto z adresem {email} istnieje, wysłaliśmy na nie link do ustawienia nowego hasła. Link jest ważny przez godzinę.',
    back: 'Wróć do logowania',
  },
  reset: {
    seoTitle: 'Nowe hasło | Splits',
    title: 'Ustaw nowe hasło',
    lead: 'Wybierz hasło, którego nie używasz nigdzie indziej.',
    password: 'Nowe hasło',
    confirm: 'Powtórz nowe hasło',
    confirmError: 'Hasła się różnią.',
    submit: 'Zapisz nowe hasło',
    submitting: 'Zapisywanie…',
    done: 'Hasło zmienione. Zaloguj się nowym hasłem.',
    missing:
      'Ten link jest niepełny. Otwórz ponownie link z e-maila albo poproś o nowy.',
    again: 'Poproś o nowy link',
  },
  validation: {
    loginRequired: 'Podaj login lub e-mail.',
    passwordRequired: 'Podaj hasło.',
    username:
      'Login: 3–30 znaków, litery, cyfry, kropka, myślnik lub podkreślnik. Zaczyna się literą lub cyfrą.',
    email: 'Podaj poprawny adres e-mail.',
    passwordMin: 'Hasło musi mieć co najmniej {min} znaków.',
    passwordMax: 'Hasło może mieć najwyżej {max} znaków.',
    passwordLetter: 'Hasło musi zawierać literę.',
    passwordDigit: 'Hasło musi zawierać cyfrę.',
    terms: 'Zaakceptuj regulamin, aby założyć konto.',
  },
}

export const authMessages: Dictionary<AuthMessages> = { en, pl }
