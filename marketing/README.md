# Marketing Pointhours

## Pliki

| Plik | Format | Gdzie użyć |
|------|--------|-----------|
| `video/out/promo-{en,pl}-16x9.mp4` | 1920×1080, 28 s | YouTube, LinkedIn (wideo), reklamy w-stream, prezentacje |
| `video/out/promo-{en,pl}-9x16.mp4` | 1080×1920, 28 s | Instagram/Facebook Reels i Stories, TikTok, YouTube Shorts |
| `video/out/promo-{en,pl}-1x1.mp4`  | 1080×1080, 28 s | posty w feedzie (Facebook, Instagram, LinkedIn) |
| `video/out/promo-{en,pl}-web.mp4`  | 1280×720, 350 KB | strona główna (kopie w `public/media`, landing wybiera język odwiedzającego) |
| `video/out/short-{historia}-{en,pl}.mp4` (11 historii) | 1080×1920, 21–23 s | Shorty: YouTube Shorts, Reels, TikTok, LinkedIn (pion) |
| `public/og.png`, `og-pl.png` | 1200×630 | podgląd linku w social media i komunikatorach (EN / PL) |

Pliki `video/out/promo-{16x9,9x16,1x1,web}.mp4` bez kodu języka to starsza polska wersja (identyczna z `-pl-`).

Film nie ma ścieżki dźwiękowej: cała treść jest na ekranie, więc działa w autoodtwarzaniu bez dźwięku
(większość feedów tak go pokaże). Muzykę możesz dodać z biblioteki platformy (Meta, TikTok, YouTube)
albo w CapCut lub DaVinci Resolve.

## Zmiana filmu

Źródłem jest `video/promo.html`: kolory i dane w scenach edytujesz jak zwykły HTML,
a teksty obu języków są w słowniku `I18N` na początku skryptu (`?lang=en` domyślnie, `?lang=pl`).

```bash
# podgląd w przeglądarce (pętla)
open marketing/video/promo.html?play

# klatki kontrolne bez renderu wideo
python marketing/video/render.py --stills 2,7.6,11.2,15.6,20.8,24.5

# pełny render obu języków, z adresem strony na planszy końcowej
python marketing/video/render.py --url pointhours.com
# tylko angielski, tylko pionowy
python marketing/video/render.py --langs en --formats 9x16
```

Wymagania: Python 3, `pip install playwright pillow`, `playwright install chromium`, ffmpeg.
Render trzech formatów trwa około minuty.

Obraz Open Graph i ikony: `python marketing/brand/render.py`.

## Lektor (ElevenLabs)

Tekst i czasy lektora są w `video/voiceover.json` (EN i PL, `{name}` = nazwa produktu).

```bash
export ELEVENLABS_API_KEY=...
python marketing/video/voiceover.py --list-voices          # wybór głosu
python marketing/video/voiceover.py --name Pointhours            # → out/promo-{lang}-{format}-voice.mp4 + napisy .vtt/.srt
python marketing/video/voiceover.py --music podklad.mp3     # opcjonalny podkład ściszany pod głosem
python marketing/video/voiceover.py --dry-run               # bez API: ton testowy, sprawdza synchronizację
```

Po renderze skopiuj `promo-{lang}-web-voice.mp4` do `public/media/promo-{lang}-web.mp4`,
napisy `promo-{lang}.vtt` do `public/media/` i ustaw `hasVoice: true` w `src/features/marketing/video.ts`.

## Teksty reklam

Bez wymyślonych liczb i opinii klientów: dopóki nie masz prawdziwych danych, reklama opisuje produkt.

**Wariant A: problem z retro**
- Nagłówek: Ile czasu zjadły Code Review w tym sprincie?
- Tekst: Pointhours notuje czas na zadaniach, Code Review, pair programmingu i spotkaniach. Wpis zajmuje kilka sekund, a na koniec sprintu widzisz story pointy i godziny dla każdego rodzaju pracy. Plan Free bez karty.
- Przycisk: Zarejestruj się

**Wariant B: koniec z arkuszem**
- Nagłówek: Arkusz godzin w piątek? Już nie.
- Tekst: Timer i szablony zapisują czas na bieżąco. Code Review to link do MR i czas, pair programming to tytuł i czas. Zero przepisywania z pamięci.
- Przycisk: Wypróbuj za darmo

**Wariant C: story pointy dla całej pracy**
- Nagłówek: Code Review też ma story pointy
- Tekst: Tablica widzi tylko tickety. Pointhours liczy też review, hotfixy i spotkania, więc sprint pokazuje całą wykonaną pracę. Skalę SP ustawiasz sam.
- Przycisk: Dowiedz się więcej

**Wariant D: oferta Lifetime (na start)**
- Nagłówek: Pointhours Pro na zawsze za 99 $
- Tekst: Jedna płatność, wszystkie funkcje Pro, obecne i przyszłe. Oferta dla pierwszych użytkowników.
- Przycisk: Kup teraz

Na start puść A, B i C równolegle z tym samym budżetem i po tygodniu zostaw wariant z najniższym kosztem rejestracji.

## Grupy docelowe

- LinkedIn: stanowiska Software Engineer, Developer, Tech Lead, Engineering Manager; kraj: Polska.
- Meta: zainteresowania programowanie, Scrum, Jira, GitLab, GitHub; wiek 22–45.
- Reddit / społeczności: r/programming i polskie grupy programistów (zgodnie z regulaminem grup, bez spamu).

## Tagowanie linków (UTM)

Każdy link w reklamie oznacz, żeby w PostHogu widzieć, który kanał przynosi rejestracje:

```
https://TWOJA-DOMENA/?utm_source=linkedin&utm_medium=paid&utm_campaign=launch&utm_content=wariant-a
```

## Mierzenie

Ustaw `POSTHOG_KEY` w `.env`. Strona wysyła już zdarzenia:
- odsłony stron (automatycznie),
- `promo_video_played`, `promo_video_completed` (film na stronie głównej).

Rejestrację (`signup_completed`) i zakup (`checkout_completed`) podepniemy razem z backendem logowania i Stripe.

## Shorty (21 historii × EN/PL)

Źródło: `video/shorts.html` (jedna historia na `?story=`, teksty w słowniku `I18N`), render: `video/shorts.py`.
Każdy short: hak w pierwszej sekundzie → problem → jak to rozwiązuje Pointhours → plansza z ceną i „Link w bio”.
Treść mieści się w bezpiecznej strefie (y 200–1480 px), więc nie zasłaniają jej przyciski i opisy platform.

```bash
python marketing/video/shorts.py                      # 42 pliki w out/ (21 historii × EN/PL)
python marketing/video/shorts.py --url pointhours.com     # adres zamiast „Link w bio” (np. do reklam)
python marketing/video/shorts.py --stories pause --langs pl --stills 2,6,10,15,20   # klatki kontrolne
```

Filmy są bez dźwięku: na każdej platformie dodaj popularny podkład z jej biblioteki, bo zwiększa zasięg.
Napisy nie są potrzebne, cały tekst jest na ekranie.

| Plik | Problem | Rozwiązanie |
|---|---|---|
| `short-sprint-*` | Ticket na 3 SP zajął 4 dni, tracker pokazuje tylko „80 h programowania” | Podział sprintu na taski, review, pairing, spotkania; koszt story pointa |
| `short-pause-*` | Pilny incydent w środku zadania, timer liczy dalej złe zadanie | Pauza, przełączenie, powrót; interwały 6:40–7:20 i 9:00–10:00 |
| `short-invoice-*` | Koniec miesiąca na B2B, klient chce zestawienie godzin | Raport per ticket z SP i godzinami, eksport CSV jednym kliknięciem |
| `short-review-*` | Ponad 3 h code review, zero przesuniętych ticketów | Review z linkiem do MR, udział review w sprincie |
| `short-pairing-*` | Pairing: ticket wygląda na droższy albo czas pomocy znika | Pairing jako osobny typ pracy |
| `short-meetings-*` | Spotkania zajmują tydzień, nikt nie zna liczby | Udział spotkań w tygodniu |
| `short-extra-*` | „Możesz tylko szybko…” zjada sprint | Praca extra z godzinami na review sprintu |
| `short-estimate-*` | Wycena story pointów na oko | Godziny na SP z ostatnich sprintów |
| `short-forgot-*` | Zapomniany timer | Wpis po fakcie z godzinami od–do |
| `short-templates-*` | Te same wpisy codziennie | Szybkie szablony, jedno kliknięcie |
| `short-summary-*` | PM chce podsumowania w Jirze | Podsumowanie zadania do skopiowania |
| `short-overrun-*` | Planning na 1 h skończył się o 11:40, dodatkowy czas znika | „Przedłużyło się”: dodatkowe minuty i powód przy spotkaniu |
| `short-estvsreal-*` | „Max 4 godziny”, a nikt nie sprawdza, ile wyszło | Estymata zadania porównana z prawdziwym czasem w raporcie |
| `short-pastday-*` | W poniedziałek pusty piątek w timesheecie | Wybór dnia na ekranie Dziś i dopisanie zapomnianych wpisów |
| `short-anyproject-*` | 5 repozytoriów, 5 identycznych szablonów code review | Jeden szablon „dowolny projekt”, wybór repo przy kliknięciu |
| `short-overtime-*` | Wieczorny hotfix, o którym za miesiąc nikt nie pamięta | Nadgodziny z opisem, suma w miesiącu |
| `short-taskedit-*` | Ticket zmienił numer, 4 wpisy do poprawienia | Edycja zadania z raportu: wszystkie sesje naraz |
| `short-yearreview-*` | Ocena roczna i „robiłem płatności” | Raport z 12 miesięcy: czas, review, SP |
| `short-jiralink-*` | Ręczne przepisywanie kluczy ticketów | Wklejony link rozpoznaje ticket i MR |
| `short-switching-*` | 7 zadań przed obiadem, nic skończone | Sesje i przerwania jednego zadania |
| `short-demo-*` | Rejestracja i karta, żeby się tylko rozejrzeć | Demo na żywo bez konta |

### Opisy do publikacji

Pełna lista opisów, tytułów i hashtagów dla wszystkich 11 filmów, plan publikacji i ustawienia kont są w dokumencie
„Pointhours: kanał z shortami — start i opisy”. Poniżej opisy pierwszych trzech filmów.

**sprint · PL**
Ticket na 3 SP, a zeszły 4 dni. Gdzie poszedł sprint? Pointhours rozbija czas na taski, code review, pairing i spotkania, a na koniec pokazuje, ile naprawdę kosztuje story point. Za darmo, link w bio.
`#programista #scrum #sprint #codereview #it #b2b`

**sprint · EN**
Estimated 3 SP, took 4 days. Where did the sprint go? Pointhours splits your time into tasks, code reviews, pairing and meetings, and shows what a story point really costs. Free, link in bio.
`#developer #scrum #agile #codereview #softwareengineering #devtools`

**pause · PL**
Siedzisz w zadaniu i nagle: pilne, produkcja leży. W Pointhours dajesz pauzę, robisz hotfix i wracasz. Raport pokaże oba interwały, bez zgadywania o 17:00. Link w bio.
`#programista #devlife #hotfix #produktywność #it`

**pause · EN**
Deep in a task, then: prod is down. In Pointhours you pause, fix it and resume. Your report keeps every interval, no guessing at 5 PM. Link in bio.
`#developer #devlife #oncall #productivity #devtools`

**invoice · PL**
Ostatni dzień miesiąca, klient chce zestawienie godzin. Zamiast 2 godzin w Gicie, Slacku i Jirze: raport per ticket i eksport CSV do faktury jednym kliknięciem. Dla programistów na B2B. Link w bio.
`#b2b #jdg #programista #faktura #freelance #it`

**invoice · EN**
Last day of the month and the client wants your hours. Skip 2 hours of digging through Git, Slack and Jira: a report per ticket and a CSV for your invoice in one click. Link in bio.
`#freelancer #contractor #developer #timesheet #devtools`

### Opisy do 10 nowych shortów

**overrun · PL**
Planning zaplanowany na godzinę skończył się o 11:40. W Pointhours klikasz „Przedłużyło się”, dopisujesz 40 minut i powód. Na retro masz liczby, nie wrażenia. Link w bio.
`#programista #scrum #spotkania #retro #it`

**overrun · EN**
Sprint planning was booked for an hour and ended at 11:40. In Pointhours you tap “Ran over”, add the 40 minutes and why. Bring numbers to the retro, not feelings. Link in bio.
`#developer #scrum #meetings #agile #devtools`

**estvsreal · PL**
„Max 4 godziny.” Wyszło 6,5. Wpisz estymatę przy zadaniu, a raport pokaże, o ile się rozjechała. Po sprincie wiesz, ile dodać na kolejnym refinemencie. Link w bio.
`#programista #estymacja #scrum #refinement #it`

**estvsreal · EN**
“4 hours, tops.” It took 6.5. Add an estimate to the task and the report shows how far off it was. After one sprint you know how much to add next time. Link in bio.
`#developer #estimation #scrum #agile #devtools`

**pastday · PL**
Poniedziałek rano, a piątek pusty. Cofasz się o dzień na ekranie Dziś i dopisujesz zadania, review i spotkania. Minuta zamiast zgadywania. Link w bio.
`#programista #timesheet #b2b #produktywność #it`

**pastday · EN**
Monday morning and Friday is empty. Go back a day on Today and add the tasks, reviews and meetings you forgot. One minute instead of guessing. Link in bio.
`#developer #timesheet #freelancer #productivity #devtools`

**anyproject · PL**
5 repozytoriów i 5 takich samych szablonów code review? W Pointhours jeden szablon „dowolny projekt”: klikasz i wybierasz repo. Nowe repo pojawia się na liście samo. Link w bio.
`#programista #codereview #gitlab #github #it`

**anyproject · EN**
5 repos and 5 identical code review templates? In Pointhours it’s one “any project” template: tap it and pick the repo. New repos show up on their own. Link in bio.
`#developer #codereview #github #gitlab #devtools`

**overtime · PL**
Czwartek, 19:30, produkcja leży. Naprawiasz po godzinach i oznaczasz to jako nadgodziny z opisem. Na koniec miesiąca masz sumę i dowód. Link w bio.
`#programista #nadgodziny #dyżur #devlife #it`

**overtime · EN**
Thursday, 7:30 PM, prod is down. You fix it after hours and mark it as overtime with what you did. At the end of the month you have the total and the proof. Link in bio.
`#developer #oncall #overtime #devlife #devtools`

**taskedit · PL**
Ticket zmienił numer, a Ty masz 4 wpisy do poprawienia? W raporcie klikasz zadanie, zmieniasz tytuł raz i gotowe we wszystkich sesjach. Link w bio.
`#programista #jira #timesheet #produktywność #it`

**taskedit · EN**
The ticket got renamed and you have 4 entries to fix? Click the task in the report, change the title once and every session is updated. Link in bio.
`#developer #jira #timesheet #productivity #devtools`

**yearreview · PL**
„Co dowiozłeś w tym roku?” Zamiast trzech ogólników: 12 miesięcy w liczbach, czas na taskach, 380 code review, 412 story pointów. Idź na ocenę z faktami. Link w bio.
`#programista #ocenaroczna #kariera #it #devlife`

**yearreview · EN**
“What did you deliver this year?” Skip the three vague bullets: 12 months in numbers, time on tasks, 380 code reviews, 412 story points. Walk into your review with facts. Link in bio.
`#developer #performancereview #career #softwareengineering #devtools`

**jiralink · PL**
Kopiujesz klucz ticketu, wklejasz, przepisujesz tytuł. 20 razy w tygodniu. W Pointhours wklejasz link, a PAY-142 albo !486 rozpoznaje się samo. Link w bio.
`#programista #jira #gitlab #produktywność #it`

**jiralink · EN**
Copy the ticket key, paste, retype the title. 20 times a week. In Pointhours you paste the link and PAY-142 or !486 fills itself in. Link in bio.
`#developer #jira #gitlab #productivity #devtools`

**switching · PL**
7 zadań przed obiadem i żadne nieskończone? Pointhours pokazuje każdą sesję i każde przerwanie. Pokaż to przed kolejnym „szybkim pytaniem”. Link w bio.
`#programista #focus #deepwork #devlife #it`

**switching · EN**
7 tasks before lunch and none finished? Pointhours shows every session and every interruption. Show it before the next “quick question”. Link in bio.
`#developer #focus #deepwork #devlife #devtools`

**demo · PL**
Rejestracja, mail, karta, żeby się tylko rozejrzeć? W Pointhours otwierasz demo z przykładowym sprintem bez zakładania konta. Podoba się, to się zapisujesz. Link w bio.
`#programista #narzędzia #timetracking #it #saas`

**demo · EN**
Sign up, confirm email, add a card, just to look around? Pointhours opens a live demo with a sample sprint, no account needed. Like it? Then sign up. Link in bio.
`#developer #devtools #timetracking #saas #productivity`
