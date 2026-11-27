import type { Dictionary } from '#/i18n/context'
import type { LegalDoc } from './types'
import { CONSENT_COOKIE } from '../data/consent'

/**
 * Polityka cookies (art. 399 ustawy z 12 lipca 2024 r. Prawo komunikacji elektronicznej):
 * informacje niezbędne do działania usługi nie wymagają zgody, pozostałe tylko za zgodą.
 */
const pl: LegalDoc = {
  title: 'Polityka cookies',
  summary:
    'Jakie pliki cookies i dane w pamięci przeglądarki zapisuje {name}, po co i jak zmienić swój wybór.',
  sections: [
    {
      id: 'what',
      heading: '1. Czym są cookies',
      blocks: [
        'Cookies to małe pliki tekstowe zapisywane w przeglądarce. Podobnie działa pamięć lokalna przeglądarki (localStorage). Ta polityka opisuje oba sposoby i stanowi uzupełnienie [polityki prywatności](/privacy).',
        'Zgodnie z art. 399 Prawa komunikacji elektronicznej informacje niezbędne do świadczenia usługi, o którą prosisz, zapisujemy bez zgody. Wszystkie pozostałe, w tym statystyki, tylko po Twojej zgodzie.',
      ],
    },
    {
      id: 'list',
      heading: '2. Co zapisujemy',
      blocks: [
        {
          table: {
            head: ['Nazwa', 'Rodzaj', 'Cel', 'Ważność'],
            rows: [
              [
                'app_locale',
                'Niezbędne, cookie',
                'Zapamiętuje wybrany język',
                '1 rok',
              ],
              [
                CONSENT_COOKIE,
                'Niezbędne, cookie',
                'Zapamiętuje Twój wybór dotyczący cookies',
                '12 miesięcy',
              ],
              [
                'refresh_token',
                'Niezbędne, cookie HttpOnly',
                'Utrzymuje zalogowanie (bez dostępu z JavaScript)',
                '30 dni',
              ],
              [
                'setup:*',
                'Niezbędne, localStorage',
                'Postęp listy kroków konfiguracji w tej przeglądarce',
                'Do wyczyszczenia danych witryny',
              ],
              [
                'ph-theme',
                'Niezbędne, localStorage',
                'Wybrany motyw panelu (jasny, ciemny, jak w systemie)',
                'Do wyczyszczenia danych witryny',
              ],
              [
                'ph-clock',
                'Niezbędne, localStorage',
                'Wybrany format godziny (12- albo 24-godzinny)',
                'Do wyczyszczenia danych witryny',
              ],
              [
                'demo-v1:*',
                'Niezbędne, localStorage',
                'Dane konta demo (tylko w trybie demo)',
                'Do usunięcia konta demo lub wyczyszczenia danych',
              ],
              [
                'ph_*_posthog',
                'Statystyki, cookie i localStorage',
                'Anonimowe statystyki korzystania (PostHog, serwery w UE)',
                '1 rok; tylko za zgodą',
              ],
              [
                '__stripe_mid, __stripe_sid',
                'Niezbędne do płatności, cookies Stripe',
                'Zapobieganie oszustwom na stronie płatności Stripe',
                'do 1 roku; zapisuje je Stripe',
              ],
            ],
          },
        },
        'Nie używamy cookies reklamowych ani śledzących między stronami.',
      ],
    },
    {
      id: 'choice',
      heading: '3. Jak zmienić wybór',
      blocks: [
        'Przy pierwszej wizycie pytamy o zgodę na statystyki. Wybór zmienisz w każdej chwili przyciskiem „Ustawienia cookies” w stopce strony. Wycofanie zgody usuwa cookies statystyk i zatrzymuje ich zbieranie.',
        'Możesz też usuwać i blokować cookies w ustawieniach przeglądarki. Zablokowanie cookies niezbędnych może uniemożliwić logowanie.',
      ],
    },
    {
      id: 'date',
      heading: '4. Obowiązywanie',
      blocks: ['Polityka obowiązuje od {date}. Pytania: {privacyEmail}.'],
    },
  ],
}

const en: LegalDoc = {
  title: 'Cookie Policy',
  summary:
    'Which cookies and browser storage {name} uses, why, and how to change your choice.',
  sections: [
    {
      id: 'what',
      heading: '1. What cookies are',
      blocks: [
        'Cookies are small text files stored by your browser. Browser storage (localStorage) works in a similar way. This policy covers both and complements our [Privacy Policy](/privacy).',
        'Under the EU ePrivacy rules (in Poland, Article 399 of the Electronic Communications Law) we store information that is strictly necessary for the service you asked for without consent. Everything else, including statistics, only with your consent.',
      ],
    },
    {
      id: 'list',
      heading: '2. What we store',
      blocks: [
        {
          table: {
            head: ['Name', 'Type', 'Purpose', 'Expiry'],
            rows: [
              [
                'app_locale',
                'Necessary, cookie',
                'Remembers your language',
                '1 year',
              ],
              [
                CONSENT_COOKIE,
                'Necessary, cookie',
                'Remembers your cookie choice',
                '12 months',
              ],
              [
                'refresh_token',
                'Necessary, HttpOnly cookie',
                'Keeps you signed in (not readable by JavaScript)',
                '30 days',
              ],
              [
                'setup:*',
                'Necessary, localStorage',
                'Progress of the setup checklist in this browser',
                'Until you clear site data',
              ],
              [
                'ph-theme',
                'Necessary, localStorage',
                'Your app theme (light, dark or matching the system)',
                'Until you clear site data',
              ],
              [
                'ph-clock',
                'Necessary, localStorage',
                'Your time format (12- or 24-hour)',
                'Until you clear site data',
              ],
              [
                'demo-v1:*',
                'Necessary, localStorage',
                'Demo account data (demo mode only)',
                'Until you delete the demo account or clear site data',
              ],
              [
                'ph_*_posthog',
                'Statistics, cookie and localStorage',
                'Anonymous usage statistics (PostHog, EU servers)',
                '1 year; only with consent',
              ],
              [
                '__stripe_mid, __stripe_sid',
                'Necessary for payments, Stripe cookies',
                'Fraud prevention on Stripe’s checkout page',
                'up to 1 year; set by Stripe',
              ],
            ],
          },
        },
        'We do not use advertising or cross-site tracking cookies.',
      ],
    },
    {
      id: 'choice',
      heading: '3. How to change your choice',
      blocks: [
        'On your first visit we ask for consent to statistics. You can change it at any time with “Cookie settings” in the page footer. Withdrawing consent deletes the statistics cookies and stops collection.',
        'You can also delete and block cookies in your browser settings. Blocking necessary cookies may prevent you from signing in.',
      ],
    },
    {
      id: 'date',
      heading: '4. Effective date',
      blocks: ['This policy applies from {date}. Questions: {privacyEmail}.'],
    },
  ],
}

export const cookiesDoc: Dictionary<LegalDoc> = { en, pl }
