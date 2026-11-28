import type { Dictionary } from '#/i18n/context'
import type { LegalDoc } from './types'

/**
 * Deklaracja dostępności: informacja o tym, jak usługa spełnia wymagania dostępności
 * (Europejski Akt o Dostępności, dyrektywa 2019/882, zał. V; w Polsce ustawa z 26 kwietnia
 * 2024 r. o zapewnianiu spełniania wymagań dostępności niektórych produktów i usług przez
 * podmioty gospodarcze). Aktualizuj datę `updated` przy każdym przeglądzie i opisuj
 * znane ograniczenia uczciwie: to dokument dla ludzi, którzy na nim polegają.
 */
const UPDATED = '2026-11-27'

const polish: LegalDoc = {
  title: 'Deklaracja dostępności',
  summary:
    'Jak {name} dba o dostępność, co już działa, czego jeszcze brakuje i jak zgłosić problem.',
  updated: UPDATED,
  sections: [
    {
      id: 'commitment',
      heading: '1. Nasze zobowiązanie',
      blocks: [
        'Chcemy, żeby z {name} mogła korzystać każda osoba, także z niepełnosprawnościami, bez względu na to, czy używa myszy, klawiatury, czytnika ekranu, powiększenia czy trybu wysokiego kontrastu.',
        'Celem jest zgodność z wytycznymi **WCAG 2.2 na poziomie AA**. Obejmuje to wymagania dla stron i aplikacji z normy EN 301 549, do której odwołują się Europejski Akt o Dostępności i polska ustawa o zapewnianiu spełniania wymagań dostępności niektórych produktów i usług.',
      ],
    },
    {
      id: 'status',
      heading: '2. Stan zgodności',
      blocks: [
        'Według naszej oceny serwis jest **częściowo zgodny** z WCAG 2.2 AA: spełnia wymagania poza ograniczeniami opisanymi w pkt 5. To samoocena; serwis nie przeszedł jeszcze zewnętrznego audytu.',
      ],
    },
    {
      id: 'features',
      heading: '3. Co ułatwia korzystanie',
      blocks: [
        {
          ul: [
            '**Klawiatura**: wszystko działa bez myszy, z widocznym fokusem i odnośnikiem „Przejdź do treści”. Paleta poleceń (Ctrl+K albo ⌘K) prowadzi do stron, zadań i akcji, a szybkie szablony mają skróty Alt+1–9.',
            '**Czytniki ekranu**: strony mają nagłówki, regiony i tytuły, przyciski i pola mają nazwy, a zapis, start timera czy błędy są ogłaszane.',
            '**Wykresy**: liczby z każdego wykresu są dostępne także jako tekst (tabela „Pokaż jako tabelę”, lista albo podpis przy słupku), a informacje nie są przekazywane samym kolorem.',
            '**Wygląd**: motyw jasny i ciemny, obsługa trybu wysokiego kontrastu w Windows, ograniczenie animacji przy ustawieniu systemowym „ogranicz ruch”, układ działający przy szerokości 320 px i powiększeniu do 400%.',
            '**Formularze**: każde pole ma etykietę, błędy są opisane tekstem przy polu, a godziny można wpisywać swobodnie (np. 930, 14:30, 2:30 pm) w formacie 12- albo 24-godzinnym.',
            '**Logowanie**: bez zagadek CAPTCHA; menedżery haseł i wklejanie działają, sesja odnawia się sama, więc nic nie wygasa w trakcie wpisywania.',
            '**Język**: polski i angielski, z prostym językiem w interfejsie.',
          ],
        },
      ],
    },
    {
      id: 'testing',
      heading: '4. Jak sprawdzamy dostępność',
      blocks: [
        {
          ul: [
            'Automatyczne testy (axe-core, reguły WCAG 2.2 AA) każdej strony w motywie jasnym i ciemnym, na komputerze i telefonie, przy każdej zmianie w kodzie.',
            'Testy obsługi klawiaturą, kolejności i widoczności fokusu, układu przy 320 px oraz trybu wysokiego kontrastu.',
            'Planujemy regularne sprawdzanie z czytnikami ekranu (NVDA z Firefoksem, VoiceOver z Safari) i zewnętrzny audyt.',
          ],
        },
      ],
    },
    {
      id: 'limitations',
      heading: '5. Znane ograniczenia',
      blocks: [
        {
          ul: [
            '**Płatności** obsługuje zewnętrzna strona Stripe Checkout. Jej dostępność zależy od Stripe; w razie problemu napisz do nas, a pomożemy opłacić plan inaczej.',
            '**Edytor notatek** pokazuje formatowanie na żywo, ale czytnik ekranu odczytuje notatkę jako zwykły tekst ze znacznikami Markdown (np. pogrubienie jako tekst między gwiazdkami).',
            '**Kolory rodzajów pracy** wybierasz sam; nie wszystkie zestawienia kolorów mają wysoki kontrast między sobą. Nazwy rodzajów pracy są zawsze podane obok koloru.',
            '**Wiadomości e-mail** (np. przypomnienia) są proste, ale nie przeszły osobnych testów z czytnikami ekranu.',
          ],
        },
      ],
    },
    {
      id: 'compatibility',
      heading: '6. Zgodność z przeglądarkami',
      blocks: [
        'Serwis działa w aktualnych wersjach Chrome, Edge, Firefox i Safari na komputerach oraz w przeglądarkach na iOS i Androidzie.',
      ],
    },
    {
      id: 'feedback',
      heading: '7. Zgłoś problem z dostępnością',
      blocks: [
        'Jeśli coś utrudnia Ci korzystanie z serwisu albo potrzebujesz informacji w innej formie, napisz na {email}. Opisz, czego dotyczy problem, na jakiej stronie i jakiego sprzętu lub oprogramowania używasz. Odpowiadamy w ciągu 5 dni roboczych.',
        'Jeśli nie odpowiemy albo odpowiedź Cię nie zadowoli, możesz zawiadomić Prezesa Zarządu Państwowego Funduszu Rehabilitacji Osób Niepełnosprawnych, który nadzoruje dostępność produktów i usług w Polsce: [pfron.org.pl](https://www.pfron.org.pl).',
      ],
    },
  ],
}

const english: LegalDoc = {
  title: 'Accessibility statement',
  summary:
    'How {name} approaches accessibility, what already works, what is still missing and how to report a problem.',
  updated: UPDATED,
  sections: [
    {
      id: 'commitment',
      heading: '1. Our commitment',
      blocks: [
        'We want everyone to be able to use {name}, including people with disabilities, whether they use a mouse, a keyboard, a screen reader, magnification or high-contrast mode.',
        'We aim to conform to **WCAG 2.2 at level AA**. This covers the web and app requirements of EN 301 549, the standard referenced by the European Accessibility Act and by the Polish act implementing it.',
      ],
    },
    {
      id: 'status',
      heading: '2. Conformance status',
      blocks: [
        'In our assessment the service is **partially conformant** with WCAG 2.2 AA: it meets the requirements except for the limitations listed in section 5. This is a self-assessment; the service has not had an external audit yet.',
      ],
    },
    {
      id: 'features',
      heading: '3. What makes it easier to use',
      blocks: [
        {
          ul: [
            '**Keyboard**: everything works without a mouse, with a visible focus and a “Skip to main content” link. The command palette (Ctrl+K or ⌘K) reaches pages, tasks and actions, and quick templates have Alt+1–9 shortcuts.',
            '**Screen readers**: pages have headings, landmarks and titles, buttons and fields have names, and saving, starting a timer and errors are announced.',
            '**Charts**: the numbers behind every chart are also available as text (a “Show as a table” table, a list or a label on each bar), and no information relies on color alone.',
            '**Appearance**: light and dark themes, Windows high-contrast mode, reduced animation when the system asks for less motion, and a layout that works at 320 px wide and 400% zoom.',
            '**Forms**: every field has a label, errors are described in text next to the field, and times can be typed freely (e.g. 930, 14:30, 2:30 pm) in 12- or 24-hour format.',
            '**Signing in**: no CAPTCHA puzzles; password managers and pasting work, and the session renews itself so nothing expires while you type.',
            '**Language**: English and Polish, with plain language in the interface.',
          ],
        },
      ],
    },
    {
      id: 'testing',
      heading: '4. How we check accessibility',
      blocks: [
        {
          ul: [
            'Automated tests (axe-core, WCAG 2.2 AA rules) of every page in the light and dark theme, on desktop and mobile, on every code change.',
            'Tests of keyboard use, focus order and visibility, the 320 px layout and high-contrast mode.',
            'We plan regular checks with screen readers (NVDA with Firefox, VoiceOver with Safari) and an external audit.',
          ],
        },
      ],
    },
    {
      id: 'limitations',
      heading: '5. Known limitations',
      blocks: [
        {
          ul: [
            '**Payments** are handled by Stripe Checkout, an external page. Its accessibility depends on Stripe; if it gets in your way, write to us and we will help you pay another way.',
            '**The notes editor** shows formatting as you type, but a screen reader reads the note as plain text with Markdown marks (e.g. bold as text between asterisks).',
            '**Kind-of-work colors** are chosen by you, and not every combination contrasts strongly with the others. The name of the kind of work is always shown next to its color.',
            '**Emails** (e.g. reminders) are simple but have not been tested separately with screen readers.',
          ],
        },
      ],
    },
    {
      id: 'compatibility',
      heading: '6. Browser support',
      blocks: [
        'The service works in current versions of Chrome, Edge, Firefox and Safari on desktop and in mobile browsers on iOS and Android.',
      ],
    },
    {
      id: 'feedback',
      heading: '7. Report an accessibility problem',
      blocks: [
        'If something makes the service hard to use, or you need information in another format, write to {email}. Tell us what the problem is, on which page, and what device and software you use. We reply within 5 working days.',
        'If we do not reply, or you are not satisfied with the answer, you can notify the President of the Management Board of the State Fund for Rehabilitation of Disabled Persons (PFRON), which oversees the accessibility of products and services in Poland: [pfron.org.pl](https://www.pfron.org.pl).',
      ],
    },
  ],
}

export const accessibilityDoc: Dictionary<LegalDoc> = {
  pl: polish,
  en: english,
}
