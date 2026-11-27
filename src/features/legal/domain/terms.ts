import type { Dictionary } from '#/i18n/context'
import type { LegalDoc } from './types'

/**
 * Regulamin świadczenia usług drogą elektroniczną (art. 8 ustawy z 18 lipca 2002 r.
 * o świadczeniu usług drogą elektroniczną) z postanowieniami konsumenckimi
 * (ustawa z 30 maja 2014 r. o prawach konsumenta, w tym rozdział 5b o usługach cyfrowych).
 */
const pl: LegalDoc = {
  title: 'Regulamin',
  summary:
    'Zasady korzystania z {name}: konto, plany Free i Pro (płatny miesięcznie albo rocznie), płatności, odstąpienie od umowy, reklamacje i odpowiedzialność.',
  sections: [
    {
      id: 'general',
      heading: '1. Postanowienia ogólne',
      blocks: [
        'Ten regulamin określa zasady korzystania z serwisu {name} dostępnego pod adresem {url} (dalej: „Serwis”) i jest regulaminem, o którym mowa w art. 8 ustawy z 18 lipca 2002 r. o świadczeniu usług drogą elektroniczną.',
        'Serwis prowadzi {operator}, {address}, {ids} (dalej: „Usługodawca”, „my”). Kontakt: {email}.',
        'Przed założeniem konta zapoznaj się z regulaminem, [polityką prywatności](/privacy) i [polityką cookies](/cookies). Regulamin jest dostępny bezpłatnie w Serwisie i możesz go zapisać lub wydrukować.',
      ],
    },
    {
      id: 'definitions',
      heading: '2. Definicje',
      blocks: [
        {
          ul: [
            '**Użytkownik**: osoba, która korzysta z Serwisu.',
            '**Konsument**: osoba fizyczna zawierająca umowę niezwiązaną bezpośrednio z jej działalnością gospodarczą lub zawodową.',
            '**Przedsiębiorca na prawach konsumenta**: osoba fizyczna prowadząca działalność gospodarczą, która zawiera umowę niemającą dla niej charakteru zawodowego (art. 38a ustawy o prawach konsumenta). Ma prawa konsumenta opisane w pkt 7 i 10.',
            '**Konto**: indywidualne konto Użytkownika w Serwisie.',
            '**Plan Free**: bezpłatny plan na czas nieokreślony.',
            '**Plan Pro**: płatna subskrypcja miesięczna albo roczna, opłacana z góry za wybrany okres (miesiąc albo 12 miesięcy). Oba warianty dają te same funkcje.',
            '**Treści Użytkownika**: dane wprowadzane do Serwisu, w szczególności wpisy czasu, notatki, zadania, projekty i ustawienia.',
          ],
        },
      ],
    },
    {
      id: 'services',
      heading: '3. Rodzaje i zakres usług',
      blocks: [
        'Za pośrednictwem Serwisu świadczymy drogą elektroniczną następujące usługi:',
        {
          ul: [
            'prowadzenie Konta,',
            'rejestrowanie czasu pracy (formularz wpisu, timer, szablony), notatek i zadań,',
            'sprinty, skala story pointów, raporty i podsumowania zadań,',
            'w planach płatnych: pełna historia raportów, eksport danych i funkcje opisane w [cenniku](/pricing).',
          ],
        },
        'Umowa o prowadzenie Konta w planie Free jest zawierana na czas nieokreślony z chwilą rejestracji. Umowa planu Pro jest zawierana na wybrany okres rozliczeniowy (miesiąc albo rok) i odnawia się automatycznie na kolejne takie okresy, dopóki nie wyłączysz odnowienia.',
      ],
    },
    {
      id: 'requirements',
      heading: '4. Wymagania techniczne',
      blocks: [
        'Do korzystania z Serwisu potrzebujesz:',
        {
          ul: [
            'urządzenia z dostępem do internetu,',
            'aktualnej przeglądarki (jedna z dwóch ostatnich wersji Chrome, Firefox, Safari albo Edge) z włączoną obsługą JavaScript i plików cookies niezbędnych do działania Serwisu,',
            'aktywnego adresu e-mail albo konta Google.',
          ],
        },
        'Korzystanie z internetu wiąże się z typowymi zagrożeniami, np. złośliwym oprogramowaniem lub próbami przejęcia hasła. Chroń swoje urządzenie i nie udostępniaj hasła innym osobom.',
      ],
    },
    {
      id: 'account',
      heading: '5. Konto',
      blocks: [
        {
          ol: [
            'Konto zakładasz, podając adres e-mail i hasło albo logując się przez Google, i akceptując regulamin.',
            'Z Serwisu mogą korzystać osoby, które ukończyły 16 lat. Plan płatny może kupić osoba pełnoletnia albo osoba niepełnoletnia za zgodą przedstawiciela ustawowego.',
            'Konto jest osobiste. Podajesz prawdziwe dane i dbasz o poufność hasła. Jeśli podejrzewasz, że ktoś uzyskał dostęp do Konta, zmień hasło i napisz do nas.',
            'Konto możesz usunąć w każdej chwili w Ustawienia → Account. Usunięcie Konta kończy umowę.',
          ],
        },
      ],
    },
    {
      id: 'payments',
      heading: '6. Plany płatne i płatności',
      blocks: [
        {
          ol: [
            'Aktualne ceny i zakres planów są w [cenniku](/pricing). Ceny podajemy w dolarach amerykańskich (USD). Dla konsumentów ceny zawierają podatek VAT, jeżeli ma zastosowanie.',
            'Płatności obsługuje Stripe Payments Europe Ltd. (Irlandia). Nie przechowujemy pełnych danych kart płatniczych.',
            'Plan Pro jest płatny z góry za wybrany okres rozliczeniowy, miesiąc albo rok: opłatę pobieramy w dniu zakupu, a potem w dniu każdego odnowienia. Okres zmienisz w ustawieniach Konta; różnicę rozliczamy proporcjonalnie przy kolejnej płatności.',
            'Plan Pro odnawia się automatycznie na kolejny okres rozliczeniowy, dopóki nie wyłączysz odnowienia w ustawieniach Konta (Ustawienia → Plan). Wyłączenie działa od następnego okresu; do końca opłaconego okresu zachowujesz dostęp do planu Pro.',
            'Co najmniej 7 dni przed odnowieniem wysyłamy na adres e-mail Konta przypomnienie z datą odnowienia i kwotą.',
            'Faktury i rachunki wystawiamy elektronicznie i udostępniamy na adres e-mail Konta.',
            'O zmianie ceny planu Pro informujemy co najmniej 30 dni przed odnowieniem. Nowa cena obowiązuje od kolejnego okresu rozliczeniowego; jeżeli się na nią nie zgadzasz, możesz wyłączyć odnowienie przed jego datą.',
          ],
        },
      ],
    },
    {
      id: 'withdrawal',
      heading: '7. Odstąpienie od umowy i zwrot pieniędzy',
      blocks: [
        {
          ol: [
            'Konsument i przedsiębiorca na prawach konsumenta mogą odstąpić od umowy planu płatnego bez podania przyczyny w ciągu 14 dni od jej zawarcia, czyli od pierwszej płatności za dany plan.',
            'Wystarczy wysłać oświadczenie na {email}, np. według wzoru z pkt 16. Do zachowania terminu wystarczy wysłanie oświadczenia przed jego upływem.',
            'Zwracamy całą zapłaconą kwotę w ciągu 14 dni od otrzymania oświadczenia, tą samą metodą płatności, chyba że uzgodnimy inną. Nie pobieramy opłaty za okres, w którym korzystałeś z planu.',
            'Taki sam 14-dniowy zwrot stosujemy dobrowolnie także wobec pozostałych Użytkowników, przy pierwszym zakupie danego planu.',
            'Także po automatycznym odnowieniu możesz w ciągu 14 dni od pobrania opłaty zrezygnować z nowego okresu i otrzymać pełny zwrot tej opłaty. Wystarczy wiadomość na {email}.',
          ],
        },
      ],
    },
    {
      id: 'rules',
      heading: '8. Zasady korzystania z Serwisu',
      blocks: [
        'Korzystając z Serwisu, nie możesz:',
        {
          ul: [
            'dostarczać treści o charakterze bezprawnym ani naruszających prawa osób trzecich,',
            'naruszać bezpieczeństwa Serwisu, próbować uzyskać dostęp do cudzych kont lub danych, obchodzić limitów planów,',
            'masowo pobierać danych z Serwisu w sposób automatyczny poza udostępnionym API i eksportem,',
            'odsprzedawać dostępu do Serwisu bez naszej zgody.',
          ],
        },
        'W razie naruszenia tych zasad możemy zablokować dostęp do Konta w zakresie niezbędnym do usunięcia zagrożenia, a w poważnych przypadkach rozwiązać umowę zgodnie z pkt 12.',
      ],
    },
    {
      id: 'content',
      heading: '9. Twoje dane i treści',
      blocks: [
        {
          ol: [
            'Treści Użytkownika należą do Ciebie. Udzielasz nam niewyłącznej, nieodpłatnej licencji wyłącznie w zakresie potrzebnym do świadczenia usług: przechowywania, przetwarzania, wyświetlania i tworzenia kopii zapasowych.',
            'Nie przeglądamy Twoich wpisów ani notatek, chyba że poprosisz o pomoc techniczną albo wymaga tego prawo.',
            'Możesz w każdej chwili pobrać swoje dane (eksport w planie Pro albo na prośbę wysłaną na {email}) i usunąć Konto. Po usunięciu Konta dane znikają z kopii zapasowych w ciągu {backupDays} dni.',
          ],
        },
      ],
    },
    {
      id: 'availability',
      heading: '10. Dostępność i zmiany Serwisu',
      blocks: [
        {
          ol: [
            'Dbamy o ciągłość działania Serwisu. Prace techniczne planujemy w godzinach małego ruchu i, gdy to możliwe, zapowiadamy w Serwisie.',
            'Możemy rozwijać i zmieniać funkcje Serwisu, np. ze względu na bezpieczeństwo, zmiany prawa albo rozwój produktu.',
            'Jeżeli zmiana usługi cyfrowej w planie płatnym istotnie i negatywnie wpływa na dostęp do niej lub korzystanie z niej przez konsumenta, poinformujemy o niej z wyprzedzeniem na trwałym nośniku. Konsument może wtedy wypowiedzieć umowę w ciągu 30 dni od zmiany albo od informacji o niej i otrzymać zwrot za niewykorzystany okres.',
          ],
        },
      ],
    },
    {
      id: 'complaints',
      heading: '11. Reklamacje i zgodność usługi z umową',
      blocks: [
        {
          ol: [
            'Wobec konsumentów i przedsiębiorców na prawach konsumenta odpowiadamy za zgodność usługi cyfrowej z umową na zasadach rozdziału 5b ustawy o prawach konsumenta.',
            'Reklamację wyślij na {email}. Opisz, czego dotyczy, i podaj adres e-mail Konta. Pomoże opis kroków, zrzut ekranu i informacja o przeglądarce.',
            'Odpowiadamy w ciągu 14 dni od otrzymania reklamacji.',
            'Jeżeli usługa nie jest zgodna z umową, konsument może żądać doprowadzenia jej do zgodności, a gdy to niemożliwe lub nieskuteczne, obniżenia ceny albo odstąpienia od umowy.',
          ],
        },
      ],
    },
    {
      id: 'liability',
      heading: '12. Odpowiedzialność i rozwiązanie umowy',
      blocks: [
        {
          ol: [
            'Serwis jest narzędziem pomocniczym. Raporty i podsumowania są obliczane z danych, które wprowadzasz; odpowiadasz za ich poprawność i za decyzje podjęte na ich podstawie.',
            'Wobec Użytkowników niebędących konsumentami ani przedsiębiorcami na prawach konsumenta nasza odpowiedzialność jest ograniczona do szkody rzeczywistej i do kwoty opłat zapłaconych za ostatnie 12 miesięcy, z wyjątkiem szkody wyrządzonej umyślnie.',
            'Możesz rozwiązać umowę w każdej chwili, usuwając Konto.',
            'Możemy wypowiedzieć umowę z 14-dniowym terminem wypowiedzenia z ważnych przyczyn: rażącego lub uporczywego naruszania regulaminu po bezskutecznym wezwaniu albo zakończenia działalności Serwisu. W razie dostarczania treści bezprawnych albo zagrożenia bezpieczeństwa możemy zablokować Konto natychmiast.',
            'Jeżeli wypowiadamy umowę z przyczyn, które nie leżą po Twojej stronie, zwracamy proporcjonalną część opłaty za niewykorzystany okres.',
          ],
        },
      ],
    },
    {
      id: 'disputes',
      heading: '13. Pozasądowe rozwiązywanie sporów',
      blocks: [
        'Konsument może skorzystać z bezpłatnej pomocy miejskiego lub powiatowego rzecznika konsumentów albo wojewódzkiego inspektora Inspekcji Handlowej, który prowadzi mediacje i stałe sądy polubowne. Informacje są na stronie [prawakonsumenta.uokik.gov.pl](https://prawakonsumenta.uokik.gov.pl/). Udział w postępowaniu pozasądowym jest dobrowolny dla obu stron.',
      ],
    },
    {
      id: 'changes',
      heading: '14. Zmiany regulaminu',
      blocks: [
        'Regulamin możemy zmienić z ważnych przyczyn: zmiany przepisów, zmiany funkcji Serwisu, zmiany sposobu płatności albo względów bezpieczeństwa. O zmianie informujemy e-mailem i w Serwisie co najmniej 14 dni przed jej wejściem w życie. Jeżeli nie akceptujesz zmian, możesz przed tą datą rozwiązać umowę; w planie płatnym zwrócimy wtedy opłatę za niewykorzystany okres.',
      ],
    },
    {
      id: 'final',
      heading: '15. Postanowienia końcowe',
      blocks: [
        {
          ol: [
            'Do umów stosuje się prawo polskie. Wybór prawa nie pozbawia konsumenta ochrony, jaką zapewniają mu bezwzględnie obowiązujące przepisy państwa jego zwykłego pobytu.',
            'Spory rozstrzygają sądy powszechne właściwe zgodnie z przepisami ogólnymi.',
            'Regulamin jest dostępny po polsku i po angielsku. W razie rozbieżności rozstrzyga wersja polska.',
            'Regulamin obowiązuje od {date}.',
          ],
        },
      ],
    },
    {
      id: 'form',
      heading: '16. Wzór oświadczenia o odstąpieniu od umowy',
      blocks: [
        '„Adresat: {operator}, {address}, {email}. Niniejszym informuję o moim odstąpieniu od umowy dotyczącej planu Pro w serwisie {name}. Data zawarcia umowy: […]. Adres e-mail Konta: […]. Imię i nazwisko: […]. Data: […].”',
      ],
    },
  ],
}

const en: LegalDoc = {
  title: 'Terms of Service',
  summary:
    'The rules for using {name}: your account, the Free and Pro (billed monthly or yearly) plans, payments, withdrawal, complaints and liability.',
  sections: [
    {
      id: 'general',
      heading: '1. About these terms',
      blocks: [
        'These terms govern your use of {name} at {url} (the “Service”). They are the service terms required by Article 8 of the Polish Act of 18 July 2002 on Providing Services by Electronic Means.',
        'The Service is run by {operator}, {address}, {ids} (“we”, “us”). Contact: {email}.',
        'Please read these terms, our [Privacy Policy](/privacy) and [Cookie Policy](/cookies) before creating an account. The terms are available free of charge on the Service, and you can save or print them.',
      ],
    },
    {
      id: 'definitions',
      heading: '2. Definitions',
      blocks: [
        {
          ul: [
            '**User**: anyone using the Service.',
            '**Consumer**: a natural person entering into a contract not directly related to their business or profession.',
            '**Sole trader with consumer rights**: a natural person running a business who enters into a contract that is not of a professional nature for them (Article 38a of the Polish Consumer Rights Act). They have the consumer rights described in sections 7 and 10.',
            '**Account**: your personal account on the Service.',
            '**Free plan**: the free plan with no time limit.',
            '**Pro plan**: a paid monthly or yearly subscription, paid upfront for the period you choose (one month or 12 months). Both give you the same features.',
            '**Your Content**: the data you enter, in particular time entries, notes, tasks, projects and settings.',
          ],
        },
      ],
    },
    {
      id: 'services',
      heading: '3. What the Service provides',
      blocks: [
        'Through the Service we provide the following electronic services:',
        {
          ul: [
            'an Account,',
            'time tracking (entry form, timer, templates), notes and tasks,',
            'sprints, a story point scale, reports and task summaries,',
            'on paid plans: full report history, data export and the features listed on the [pricing page](/pricing).',
          ],
        },
        'The Free plan contract is concluded for an indefinite period when you sign up. The Pro plan contract runs for the billing period you choose (a month or a year) and renews automatically for further periods of the same length until you turn off renewal.',
      ],
    },
    {
      id: 'requirements',
      heading: '4. Technical requirements',
      blocks: [
        'To use the Service you need:',
        {
          ul: [
            'a device with internet access,',
            'a current browser (one of the two latest versions of Chrome, Firefox, Safari or Edge) with JavaScript and the cookies necessary for the Service enabled,',
            'a working email address or a Google account.',
          ],
        },
        'Using the internet carries common risks, such as malware or attempts to steal passwords. Keep your device secure and never share your password.',
      ],
    },
    {
      id: 'account',
      heading: '5. Your account',
      blocks: [
        {
          ol: [
            'You create an Account with an email address and password, or by signing in with Google, and by accepting these terms.',
            'You must be at least 16 to use the Service. Paid plans may be bought by adults, or by minors with the consent of a parent or legal guardian.',
            'Your Account is personal. Provide accurate information and keep your password confidential. If you think someone has accessed your Account, change your password and contact us.',
            'You can delete your Account at any time in Settings → Account. Deleting it ends the contract.',
          ],
        },
      ],
    },
    {
      id: 'payments',
      heading: '6. Paid plans and payments',
      blocks: [
        {
          ol: [
            'Current prices and plan features are on the [pricing page](/pricing). Prices are in US dollars (USD). For consumers, prices include VAT where applicable.',
            'Payments are processed by Stripe Payments Europe Ltd. (Ireland). We never store full card details.',
            'The Pro plan is paid upfront for the billing period you choose, a month or a year: we charge on the day you buy and on the day of each renewal. You can change the period in your Account settings; we settle the difference proportionally on your next payment.',
            'The Pro plan renews automatically for another billing period until you turn off renewal in your Account settings (Settings → Plan). Turning it off applies from the next period; you keep Pro until the end of the period you paid for.',
            'At least 7 days before a renewal we email you a reminder with the renewal date and amount.',
            'Invoices and receipts are issued electronically and sent to your Account email.',
            'We announce Pro price changes at least 30 days before your renewal. The new price applies from the next billing period; if you don’t agree, you can turn off renewal before that date.',
          ],
        },
      ],
    },
    {
      id: 'withdrawal',
      heading: '7. Withdrawal and refunds',
      blocks: [
        {
          ol: [
            'Consumers and sole traders with consumer rights may withdraw from a paid plan contract without giving a reason within 14 days of concluding it, that is, from the first payment for that plan.',
            'Just send us a statement at {email}, for example using the model in section 16. Sending it before the deadline is enough.',
            'We refund the full amount within 14 days of receiving your statement, using the same payment method unless we agree otherwise. We do not charge for the time you used the plan.',
            'We voluntarily offer the same 14-day refund to all other Users on their first purchase of a plan.',
            'After an automatic renewal you can also cancel the new period within 14 days of the charge and get that charge back in full. Just email {email}.',
          ],
        },
      ],
    },
    {
      id: 'rules',
      heading: '8. Acceptable use',
      blocks: [
        'When using the Service, you must not:',
        {
          ul: [
            'submit unlawful content or content that infringes the rights of others,',
            'compromise the security of the Service, try to access other people’s accounts or data, or circumvent plan limits,',
            'scrape the Service automatically other than through the provided API and export,',
            'resell access to the Service without our consent.',
          ],
        },
        'If you break these rules, we may restrict access to your Account as far as needed to remove the threat and, in serious cases, end the contract under section 12.',
      ],
    },
    {
      id: 'content',
      heading: '9. Your data and content',
      blocks: [
        {
          ol: [
            'Your Content belongs to you. You grant us a non-exclusive, free licence only to the extent needed to provide the Service: storing, processing, displaying and backing it up.',
            'We do not look at your entries or notes unless you ask for technical help or the law requires it.',
            'You can export your data at any time (export on Pro, or on request at {email}) and delete your Account. After deletion, your data is removed from backups within {backupDays} days.',
          ],
        },
      ],
    },
    {
      id: 'availability',
      heading: '10. Availability and changes',
      blocks: [
        {
          ol: [
            'We work to keep the Service running. We schedule maintenance for quiet hours and announce it in the Service when possible.',
            'We may develop and change features, for example for security, legal changes or product development.',
            'If a change to a paid digital service materially and negatively affects a consumer’s access to or use of it, we will tell you in advance on a durable medium. You may then terminate the contract within 30 days of the change or of our notice and get a refund for the unused period.',
          ],
        },
      ],
    },
    {
      id: 'complaints',
      heading: '11. Complaints and conformity',
      blocks: [
        {
          ol: [
            'Towards consumers and sole traders with consumer rights, we are liable for the conformity of the digital service with the contract under Chapter 5b of the Polish Consumer Rights Act.',
            'Send complaints to {email}. Describe the issue and include your Account email. Steps to reproduce, a screenshot and your browser help us fix it faster.',
            'We reply within 14 days of receiving your complaint.',
            'If the service does not conform to the contract, a consumer may ask us to bring it into conformity and, if that is impossible or fails, ask for a price reduction or withdraw from the contract.',
          ],
        },
      ],
    },
    {
      id: 'liability',
      heading: '12. Liability and termination',
      blocks: [
        {
          ol: [
            'The Service is a support tool. Reports and summaries are calculated from the data you enter; you are responsible for its accuracy and for decisions based on it.',
            'Towards Users who are neither consumers nor sole traders with consumer rights, our liability is limited to actual loss and to the fees paid in the last 12 months, except for intentional damage.',
            'You can end the contract at any time by deleting your Account.',
            'We may terminate the contract with 14 days’ notice for good reason: serious or repeated breach of these terms after an unanswered warning, or the Service shutting down. If you submit unlawful content or threaten security, we may block the Account immediately.',
            'If we terminate for reasons not caused by you, we refund the unused part of your fee.',
          ],
        },
      ],
    },
    {
      id: 'disputes',
      heading: '13. Out-of-court dispute resolution',
      blocks: [
        'Consumers in Poland can get free help from a municipal or district consumer ombudsman (rzecznik konsumentów) or the Trade Inspection (Inspekcja Handlowa), which offers mediation and arbitration. Details: [prawakonsumenta.uokik.gov.pl](https://prawakonsumenta.uokik.gov.pl/). Consumers in other EU countries can contact their national consumer centre (ECC-Net). Taking part in out-of-court proceedings is voluntary for both sides.',
      ],
    },
    {
      id: 'changes',
      heading: '14. Changes to these terms',
      blocks: [
        'We may change these terms for good reason: changes in law, in the Service’s features, in payment methods or for security. We will notify you by email and in the Service at least 14 days before a change takes effect. If you don’t accept it, you can end the contract before that date; on a paid plan we will refund the unused period.',
      ],
    },
    {
      id: 'final',
      heading: '15. Final provisions',
      blocks: [
        {
          ol: [
            'These terms are governed by Polish law. This choice does not deprive consumers of the protection of the mandatory laws of their country of habitual residence.',
            'Disputes are settled by the courts with jurisdiction under general rules.',
            'These terms are available in Polish and English. In case of any discrepancy, the Polish version prevails.',
            'These terms apply from {date}.',
          ],
        },
      ],
    },
    {
      id: 'form',
      heading: '16. Model withdrawal form',
      blocks: [
        '“To: {operator}, {address}, {email}. I hereby give notice that I withdraw from my contract for the Pro plan on {name}. Date of contract: […]. Account email: […]. Name: […]. Date: […].”',
      ],
    },
  ],
}

export const termsDoc: Dictionary<LegalDoc> = { en, pl }
