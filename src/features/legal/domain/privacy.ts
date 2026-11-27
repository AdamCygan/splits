import type { Dictionary } from '#/i18n/context'
import type { LegalDoc } from './types'

/** Polityka prywatności (art. 13 i 14 RODO). */
const pl: LegalDoc = {
  title: 'Polityka prywatności',
  summary:
    'Jakie dane przetwarza {name}, po co, na jakiej podstawie, jak długo, komu je powierzamy i jakie masz prawa.',
  sections: [
    {
      id: 'controller',
      heading: '1. Administrator danych',
      blocks: [
        'Administratorem Twoich danych osobowych jest {operator}, {address}, {ids}. W sprawach danych osobowych pisz na {privacyEmail}.',
        'Stosujemy rozporządzenie Parlamentu Europejskiego i Rady (UE) 2016/679 (RODO) oraz polskie przepisy o ochronie danych osobowych.',
      ],
    },
    {
      id: 'data',
      heading: '2. Jakie dane, w jakim celu i na jakiej podstawie',
      blocks: [
        {
          table: {
            head: ['Dane', 'Cel', 'Podstawa prawna (RODO)'],
            rows: [
              [
                'Adres e-mail, nazwa użytkownika, nazwa wyświetlana, skrót hasła; przy logowaniu przez Google: imię, adres e-mail i identyfikator konta Google',
                'Założenie i prowadzenie Konta, logowanie',
                'art. 6 ust. 1 lit. b (umowa)',
              ],
              [
                'Wpisy czasu, notatki, zadania, projekty, tagi, sprinty, ustawienia',
                'Świadczenie usług Serwisu, raporty i podsumowania',
                'art. 6 ust. 1 lit. b (umowa)',
              ],
              [
                'Plan, historia płatności, identyfikator klienta Stripe, dane do faktury',
                'Obsługa płatności i rozliczeń, księgowość',
                'art. 6 ust. 1 lit. b i c (umowa, obowiązek prawny z przepisów podatkowych)',
              ],
              [
                'Adres IP, typ przeglądarki, czas i rodzaj żądań, identyfikatory sesji',
                'Bezpieczeństwo, zapobieganie nadużyciom, diagnozowanie błędów',
                'art. 6 ust. 1 lit. f (prawnie uzasadniony interes: bezpieczeństwo Serwisu)',
              ],
              [
                'Zdarzenia korzystania z Serwisu (np. odwiedzone strony, użyte funkcje)',
                'Statystyki i ulepszanie produktu',
                'art. 6 ust. 1 lit. a (zgoda w banerze cookies, którą możesz wycofać)',
              ],
              [
                'Treść wiadomości i dane kontaktowe',
                'Odpowiedź na pytania, reklamacje i wnioski',
                'art. 6 ust. 1 lit. b, c lub f (zależnie od sprawy)',
              ],
              [
                'Dane potrzebne do dochodzenia lub obrony roszczeń',
                'Ustalenie, dochodzenie lub obrona roszczeń',
                'art. 6 ust. 1 lit. f (prawnie uzasadniony interes)',
              ],
            ],
          },
        },
        'Podanie danych do założenia Konta jest dobrowolne, ale bez nich nie możemy świadczyć usług. Nie podejmujemy wobec Ciebie decyzji opartych wyłącznie na zautomatyzowanym przetwarzaniu, w tym profilowania, które wywoływałyby skutki prawne.',
        'Notatek i wpisów nie używamy do reklamy, nie sprzedajemy ich i nie używamy ich do trenowania modeli sztucznej inteligencji.',
      ],
    },
    {
      id: 'recipients',
      heading: '3. Komu powierzamy dane',
      blocks: [
        'Dane przekazujemy wyłącznie podmiotom, które pomagają nam prowadzić Serwis, na podstawie umów powierzenia (art. 28 RODO) albo jako odrębnym administratorom w zakresie ich usług:',
        {
          ul: [
            'hosting i infrastruktura: {hosting},',
            'baza danych: {database},',
            'wysyłka e-maili transakcyjnych (np. potwierdzenia, reset hasła): {mail},',
            'płatności: Stripe Payments Europe Ltd. (Irlandia), który w zakresie zapobiegania oszustwom i obowiązków finansowych działa jako odrębny administrator,',
            'statystyki (tylko za Twoją zgodą): PostHog Inc. z przechowywaniem danych w UE,',
            'zgłoszenia błędów serwera: Functional Software, Inc. (Sentry) z przechowywaniem danych w UE; zgłoszenie zawiera opis błędu i identyfikator konta, bez treści Twoich wpisów i bez adresu IP,',
            'logowanie przez Google (jeżeli z niego korzystasz): Google Ireland Limited,',
            'organy publiczne, gdy wymaga tego prawo.',
          ],
        },
      ],
    },
    {
      id: 'transfers',
      heading: '4. Przekazywanie danych poza EOG',
      blocks: [
        'Dane przechowujemy w Europejskim Obszarze Gospodarczym. Niektórzy dostawcy (np. Stripe, Google, PostHog) mogą przetwarzać dane także w Stanach Zjednoczonych. Odbywa się to na podstawie decyzji Komisji Europejskiej w sprawie EU-US Data Privacy Framework wobec certyfikowanych podmiotów albo standardowych klauzul umownych zatwierdzonych przez Komisję. Kopię zabezpieczeń możesz otrzymać, pisząc na {privacyEmail}.',
      ],
    },
    {
      id: 'retention',
      heading: '5. Jak długo przechowujemy dane',
      blocks: [
        {
          ul: [
            'Dane Konta i Treści Użytkownika: do usunięcia Konta; z kopii zapasowych znikają w ciągu {backupDays} dni.',
            'Dokumenty rozliczeniowe: 5 lat od końca roku, w którym upłynął termin płatności podatku (przepisy podatkowe).',
            'Logi serwera: do {logDays} dni, dłużej tylko w razie incydentu bezpieczeństwa.',
            'Dane statystyczne: do wycofania zgody, nie dłużej niż 12 miesięcy.',
            'Korespondencja: do zakończenia sprawy, a jeżeli może być potrzebna do obrony roszczeń, do upływu terminu ich przedawnienia.',
          ],
        },
      ],
    },
    {
      id: 'rights',
      heading: '6. Twoje prawa',
      blocks: [
        'Masz prawo do:',
        {
          ul: [
            'dostępu do danych i otrzymania ich kopii,',
            'sprostowania danych,',
            'usunięcia danych („prawo do bycia zapomnianym”),',
            'ograniczenia przetwarzania,',
            'przenoszenia danych w formacie nadającym się do odczytu maszynowego,',
            'sprzeciwu wobec przetwarzania opartego na prawnie uzasadnionym interesie,',
            'wycofania zgody w dowolnym momencie (np. w [ustawieniach cookies](/cookies)); nie wpływa to na zgodność z prawem przetwarzania przed jej wycofaniem.',
          ],
        },
        'Wnioski wysyłaj na {privacyEmail}. Odpowiadamy w ciągu miesiąca. Masz też prawo wnieść skargę do Prezesa Urzędu Ochrony Danych Osobowych (ul. Stawki 2, 00-193 Warszawa, [uodo.gov.pl](https://uodo.gov.pl/)).',
      ],
    },
    {
      id: 'security',
      heading: '7. Bezpieczeństwo',
      blocks: [
        'Stosujemy szyfrowane połączenia (HTTPS), hasła przechowujemy wyłącznie jako skróty kryptograficzne, dane każdego Użytkownika są odseparowane, a dostęp do produkcyjnej bazy ma tylko upoważniona osoba. Regularnie tworzymy i testujemy kopie zapasowe.',
      ],
    },
    {
      id: 'changes',
      heading: '8. Zmiany polityki',
      blocks: [
        'O istotnych zmianach tej polityki informujemy e-mailem i w Serwisie. Wersja obowiązuje od {date}.',
      ],
    },
  ],
}

const en: LegalDoc = {
  title: 'Privacy Policy',
  summary:
    'What personal data {name} processes, why, on what legal basis, for how long, who we share it with and what your rights are.',
  sections: [
    {
      id: 'controller',
      heading: '1. Who is responsible for your data',
      blocks: [
        'The controller of your personal data is {operator}, {address}, {ids}. For anything about your data, write to {privacyEmail}.',
        'We comply with Regulation (EU) 2016/679 (GDPR) and Polish data protection law.',
      ],
    },
    {
      id: 'data',
      heading: '2. What data, why and on what basis',
      blocks: [
        {
          table: {
            head: ['Data', 'Purpose', 'Legal basis (GDPR)'],
            rows: [
              [
                'Email, username, display name, password hash; with Google sign-in: name, email and Google account ID',
                'Creating and running your Account, signing in',
                'Art. 6(1)(b) (contract)',
              ],
              [
                'Time entries, notes, tasks, projects, tags, sprints, settings',
                'Providing the Service, reports and summaries',
                'Art. 6(1)(b) (contract)',
              ],
              [
                'Plan, payment history, Stripe customer ID, billing details',
                'Payments, billing and accounting',
                'Art. 6(1)(b) and (c) (contract, tax obligations)',
              ],
              [
                'IP address, browser type, request time and type, session identifiers',
                'Security, abuse prevention, debugging',
                'Art. 6(1)(f) (legitimate interest: securing the Service)',
              ],
              [
                'Usage events (e.g. pages visited, features used)',
                'Statistics and product improvement',
                'Art. 6(1)(a) (consent in the cookie banner, which you can withdraw)',
              ],
              [
                'Message content and contact details',
                'Answering questions, complaints and requests',
                'Art. 6(1)(b), (c) or (f), depending on the request',
              ],
              [
                'Data needed to establish or defend legal claims',
                'Establishing, pursuing or defending claims',
                'Art. 6(1)(f) (legitimate interest)',
              ],
            ],
          },
        },
        'Providing data to create an Account is voluntary, but without it we cannot provide the Service. We do not make decisions based solely on automated processing, including profiling, that produce legal effects for you.',
        'We never use your notes or entries for advertising, never sell them and never use them to train AI models.',
      ],
    },
    {
      id: 'recipients',
      heading: '3. Who we share data with',
      blocks: [
        'We share data only with providers that help us run the Service, under data processing agreements (Art. 28 GDPR), or with independent controllers for their own services:',
        {
          ul: [
            'hosting and infrastructure: {hosting},',
            'database: {database},',
            'transactional email (e.g. confirmations, password resets): {mail},',
            'payments: Stripe Payments Europe Ltd. (Ireland), acting as an independent controller for fraud prevention and financial obligations,',
            'statistics (only with your consent): PostHog Inc., with data stored in the EU,',
            'server error reports: Functional Software, Inc. (Sentry), with data stored in the EU; a report contains the error and your account ID, never your entries or your IP address,',
            'Google sign-in (if you use it): Google Ireland Limited,',
            'public authorities, where the law requires it.',
          ],
        },
      ],
    },
    {
      id: 'transfers',
      heading: '4. Transfers outside the EEA',
      blocks: [
        'We store data in the European Economic Area. Some providers (e.g. Stripe, Google, PostHog) may also process data in the United States. This relies on the European Commission’s EU-US Data Privacy Framework decision for certified companies, or on Standard Contractual Clauses approved by the Commission. You can request a copy of these safeguards at {privacyEmail}.',
      ],
    },
    {
      id: 'retention',
      heading: '5. How long we keep data',
      blocks: [
        {
          ul: [
            'Account data and Your Content: until you delete your Account; removed from backups within {backupDays} days.',
            'Billing records: 5 years from the end of the year in which the tax payment deadline passed (tax law).',
            'Server logs: up to {logDays} days, longer only during a security incident.',
            'Statistics: until you withdraw consent, no longer than 12 months.',
            'Correspondence: until the matter is closed, or until the limitation period for related claims expires.',
          ],
        },
      ],
    },
    {
      id: 'rights',
      heading: '6. Your rights',
      blocks: [
        'You have the right to:',
        {
          ul: [
            'access your data and get a copy,',
            'rectify your data,',
            'have your data erased (“right to be forgotten”),',
            'restrict processing,',
            'data portability in a machine-readable format,',
            'object to processing based on legitimate interest,',
            'withdraw consent at any time (e.g. in [cookie settings](/cookies)); this does not affect processing before withdrawal.',
          ],
        },
        'Send requests to {privacyEmail}. We reply within one month. You can also lodge a complaint with your local data protection authority; in Poland that is the President of the Personal Data Protection Office (ul. Stawki 2, 00-193 Warsaw, [uodo.gov.pl](https://uodo.gov.pl/)).',
      ],
    },
    {
      id: 'security',
      heading: '7. Security',
      blocks: [
        'We use encrypted connections (HTTPS), store passwords only as cryptographic hashes, keep each User’s data separated and limit production database access to authorised people. We make and test backups regularly.',
      ],
    },
    {
      id: 'changes',
      heading: '8. Changes to this policy',
      blocks: [
        'We will tell you about material changes by email and in the Service. This version applies from {date}.',
      ],
    },
  ],
}

export const privacyDoc: Dictionary<LegalDoc> = { en, pl }
