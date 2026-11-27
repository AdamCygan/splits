import type { Dictionary } from '../context'

const en = {
  checkout: {
    seoTitle: 'Your cart',
    title: 'Your cart',
    lead: 'Check your order, then pay securely with Stripe.',
    item: 'Timeblame {plan}',
    billing: 'Billing',
    intervals: {
      month: 'Monthly',
      year: 'Yearly',
    },
    saveBadge: '2 months free',
    itemPeriod: {
      month: 'Monthly subscription, renews every month',
      year: 'Yearly subscription, paid upfront for 12 months',
    },
    included: 'What’s included',
    summary: 'Order summary',
    line: { month: '{plan}, 1 month', year: '{plan}, 1 year' },
    vat: 'VAT',
    vatValue: 'included where it applies',
    total: 'Total today',
    renews:
      'Renews on {date} for {price}. You can turn off renewal anytime in Settings → Plan.',
    promo: 'Got a discount code? You can enter it on the next step.',
    consent:
      'I accept the {terms} and the {privacy}, and I want Pro to start right after payment.',
    terms: 'Terms of Service',
    privacy: 'Privacy Policy',
    refund:
      'Changed your mind? You get a full refund within 14 days, no questions asked.',
    pay: 'Continue to payment',
    redirecting: 'Opening Stripe…',
    secure:
      'Payments are handled by Stripe. We never see or store your card details.',
    canceled:
      'Payment canceled. Your cart is still here whenever you’re ready.',
    disabled:
      'Payments aren’t switched on yet. Your cart is saved, come back in a while.',
    alreadyTitle: 'You already have Pro',
    alreadyText:
      'Manage your subscription, invoices and card in Settings → Plan.',
    goToPlan: 'Go to Settings → Plan',
    back: 'Back to plans',
  },
  plan: {
    renewsOn: 'Renews on {date}',
    endsOn: 'Pro ends on {date}. Renewal is turned off.',
    pastDue:
      'Your last payment didn’t go through. Update your card so Pro stays on.',
    buyPro: {
      month: 'Pro monthly, {price} a month',
      year: 'Pro yearly, {price} a year',
    },
    buyProHint:
      'Same Pro either way. Yearly gives you 2 months free. Full refund within 14 days.',
    billedMonthly: 'Billed monthly',
    billedYearly: 'Billed yearly',
    manage: 'Manage subscription',
    manageHint:
      'Invoices, card, billing details and renewal, on a secure Stripe page.',
    opening: 'Opening…',
    thanksTitle: 'Thank you! Pro is on.',
    thanksText:
      'Your receipt is on its way by email. Every Pro feature is unlocked now.',
    pending:
      'We’re confirming your payment. It usually takes a few seconds, refresh the page in a moment.',
    lifetimeNote:
      'You have Lifetime. Every Pro feature is yours, now and in the future.',
    adminNote:
      'Administrator account: every Pro feature is on, with no payment.',
    invoices: {
      title: 'Invoices',
      lead: 'Invoices and receipts for your payments, from Stripe.',
      empty: 'No invoices yet. They show up here after your first payment.',
      caption: 'Your invoices, newest first',
      date: 'Date',
      number: 'Number',
      amount: 'Amount',
      status: 'Status',
      actions: 'Files',
      pdf: 'PDF',
      view: 'View',
      pdfOf: 'of invoice {number}',
      viewOf: 'invoice {number}',
      noNumber: 'Draft',
      statuses: {
        paid: 'Paid',
        open: 'Due',
        draft: 'Draft',
        void: 'Void',
        uncollectible: 'Unpaid',
      } as Record<string, string>,
    },
  },
  limits: {
    upgrade: 'Upgrade to Pro',
    projects: 'The Free plan includes one project.',
    templates: 'The Free plan includes two quick templates.',
    statuses:
      'The Free plan uses the four default statuses. You can rename and reorder them.',
    workTypes:
      'The Free plan uses the built-in work types. You can still change how each one works.',
    reminders: 'Daily email reminders are part of Pro.',
  },
}

export type BillingMessages = typeof en

const pl: BillingMessages = {
  checkout: {
    seoTitle: 'Twój koszyk',
    title: 'Twój koszyk',
    lead: 'Sprawdź zamówienie i zapłać bezpiecznie przez Stripe.',
    item: 'Timeblame {plan}',
    billing: 'Płatność',
    intervals: {
      month: 'Co miesiąc',
      year: 'Co rok',
    },
    saveBadge: '2 miesiące gratis',
    itemPeriod: {
      month: 'Subskrypcja miesięczna, odnawia się co miesiąc',
      year: 'Subskrypcja roczna, płatna z góry za 12 miesięcy',
    },
    included: 'Co dostajesz',
    summary: 'Podsumowanie zamówienia',
    line: { month: '{plan}, 1 miesiąc', year: '{plan}, 1 rok' },
    vat: 'VAT',
    vatValue: 'wliczony, jeśli dotyczy',
    total: 'Do zapłaty dziś',
    renews:
      'Odnowienie {date} za {price}. Wyłączysz je w każdej chwili w Ustawienia → Plan.',
    promo: 'Masz kod rabatowy? Wpiszesz go w następnym kroku.',
    consent:
      'Akceptuję {terms} i {privacy} i chcę, żeby Pro zaczęło działać od razu po płatności.',
    terms: 'Regulamin',
    privacy: 'Politykę prywatności',
    refund:
      'Zmienisz zdanie? Masz pełny zwrot w ciągu 14 dni, bez podawania przyczyny.',
    pay: 'Przejdź do płatności',
    redirecting: 'Otwieram Stripe…',
    secure:
      'Płatność obsługuje Stripe. Nie widzimy i nie przechowujemy danych Twojej karty.',
    canceled: 'Płatność przerwana. Koszyk czeka, kiedy będziesz gotowy.',
    disabled:
      'Płatności nie są jeszcze włączone. Koszyk czeka, wróć za jakiś czas.',
    alreadyTitle: 'Masz już Pro',
    alreadyText:
      'Subskrypcją, fakturami i kartą zarządzasz w Ustawienia → Plan.',
    goToPlan: 'Przejdź do Ustawienia → Plan',
    back: 'Wróć do planów',
  },
  plan: {
    renewsOn: 'Odnawia się {date}',
    endsOn: 'Pro kończy się {date}. Odnowienie jest wyłączone.',
    pastDue:
      'Ostatnia płatność nie przeszła. Zaktualizuj kartę, żeby Pro dalej działało.',
    buyPro: {
      month: 'Pro miesięcznie, {price} za miesiąc',
      year: 'Pro rocznie, {price} za rok',
    },
    buyProHint:
      'To samo Pro w obu wariantach. Rocznie masz 2 miesiące gratis. Pełny zwrot w ciągu 14 dni.',
    billedMonthly: 'Płatne co miesiąc',
    billedYearly: 'Płatne co rok',
    manage: 'Zarządzaj subskrypcją',
    manageHint:
      'Faktury, karta, dane do faktury i odnowienie, na bezpiecznej stronie Stripe.',
    opening: 'Otwieram…',
    thanksTitle: 'Dziękujemy! Pro działa.',
    thanksText:
      'Potwierdzenie płatności dostaniesz e-mailem. Wszystkie funkcje Pro są już odblokowane.',
    pending:
      'Potwierdzamy płatność. Zwykle trwa to kilka sekund, odśwież stronę za chwilę.',
    lifetimeNote:
      'Masz Lifetime. Wszystkie funkcje Pro są Twoje, teraz i w przyszłości.',
    adminNote:
      'Konto administratora: wszystkie funkcje Pro działają bez opłat.',
    invoices: {
      title: 'Faktury',
      lead: 'Faktury i potwierdzenia płatności ze Stripe.',
      empty: 'Nie ma jeszcze faktur. Pojawią się tu po pierwszej płatności.',
      caption: 'Twoje faktury, od najnowszej',
      date: 'Data',
      number: 'Numer',
      amount: 'Kwota',
      status: 'Status',
      actions: 'Pliki',
      pdf: 'PDF',
      view: 'Zobacz',
      pdfOf: 'faktury {number}',
      viewOf: 'fakturę {number}',
      noNumber: 'Szkic',
      statuses: {
        paid: 'Opłacona',
        open: 'Do zapłaty',
        draft: 'Szkic',
        void: 'Anulowana',
        uncollectible: 'Nieopłacona',
      },
    },
  },
  limits: {
    upgrade: 'Przejdź na Pro',
    projects: 'Plan Free obejmuje jeden projekt.',
    templates: 'Plan Free obejmuje dwa szybkie szablony.',
    statuses:
      'Plan Free korzysta z czterech domyślnych statusów. Możesz zmieniać ich nazwy i kolejność.',
    workTypes:
      'Plan Free korzysta z wbudowanych typów pracy. Nadal możesz zmieniać, jak każdy z nich działa.',
    reminders: 'Codzienne przypomnienia e-mail są w planie Pro.',
  },
}

export const billingMessages: Dictionary<BillingMessages> = { en, pl }
