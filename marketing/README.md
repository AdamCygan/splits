# Marketing Splits

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
python marketing/video/render.py --url splits.app
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
python marketing/video/voiceover.py --name Splits            # → out/promo-{lang}-{format}-voice.mp4 + napisy .vtt/.srt
python marketing/video/voiceover.py --music podklad.mp3     # opcjonalny podkład ściszany pod głosem
python marketing/video/voiceover.py --dry-run               # bez API: ton testowy, sprawdza synchronizację
```

Po renderze skopiuj `promo-{lang}-web-voice.mp4` do `public/media/promo-{lang}-web.mp4`,
napisy `promo-{lang}.vtt` do `public/media/` i ustaw `hasVoice: true` w `src/features/marketing/video.ts`.

## Teksty reklam

Bez wymyślonych liczb i opinii klientów: dopóki nie masz prawdziwych danych, reklama opisuje produkt.

**Wariant A: problem z retro**
- Nagłówek: Ile czasu zjadły Code Review w tym sprincie?
- Tekst: Splits notuje czas na zadaniach, Code Review, pair programmingu i spotkaniach. Wpis zajmuje kilka sekund, a na koniec sprintu widzisz story pointy i godziny dla każdego rodzaju pracy. Plan Free bez karty.
- Przycisk: Zarejestruj się

**Wariant B: koniec z arkuszem**
- Nagłówek: Arkusz godzin w piątek? Już nie.
- Tekst: Timer i szablony zapisują czas na bieżąco. Code Review to link do MR i czas, pair programming to tytuł i czas. Zero przepisywania z pamięci.
- Przycisk: Wypróbuj za darmo

**Wariant C: story pointy dla całej pracy**
- Nagłówek: Code Review też ma story pointy
- Tekst: Tablica widzi tylko tickety. Splits liczy też review, hotfixy i spotkania, więc sprint pokazuje całą wykonaną pracę. Skalę SP ustawiasz sam.
- Przycisk: Dowiedz się więcej

**Wariant D: oferta Lifetime (na start)**
- Nagłówek: Splits Pro na zawsze za 99 $
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

## Shorty (11 historii × EN/PL)

Źródło: `video/shorts.html` (jedna historia na `?story=`, teksty w słowniku `I18N`), render: `video/shorts.py`.
Każdy short: hak w pierwszej sekundzie → problem → jak to rozwiązuje Splits → plansza z ceną i „Link w bio”.
Treść mieści się w bezpiecznej strefie (y 200–1480 px), więc nie zasłaniają jej przyciski i opisy platform.

```bash
python marketing/video/shorts.py                      # 6 plików w out/
python marketing/video/shorts.py --url splits.app     # adres zamiast „Link w bio” (np. do reklam)
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

### Opisy do publikacji

Pełna lista opisów, tytułów i hashtagów dla wszystkich 11 filmów, plan publikacji i ustawienia kont są w dokumencie
„Splits: kanał z shortami — start i opisy”. Poniżej opisy pierwszych trzech filmów.

**sprint · PL**
Ticket na 3 SP, a zeszły 4 dni. Gdzie poszedł sprint? Splits rozbija czas na taski, code review, pairing i spotkania, a na koniec pokazuje, ile naprawdę kosztuje story point. Za darmo, link w bio.
`#programista #scrum #sprint #codereview #it #b2b`

**sprint · EN**
Estimated 3 SP, took 4 days. Where did the sprint go? Splits splits your time into tasks, code reviews, pairing and meetings, and shows what a story point really costs. Free, link in bio.
`#developer #scrum #agile #codereview #softwareengineering #devtools`

**pause · PL**
Siedzisz w zadaniu i nagle: pilne, produkcja leży. W Splits dajesz pauzę, robisz hotfix i wracasz. Raport pokaże oba interwały, bez zgadywania o 17:00. Link w bio.
`#programista #devlife #hotfix #produktywność #it`

**pause · EN**
Deep in a task, then: prod is down. In Splits you pause, fix it and resume. Your report keeps every interval, no guessing at 5 PM. Link in bio.
`#developer #devlife #oncall #productivity #devtools`

**invoice · PL**
Ostatni dzień miesiąca, klient chce zestawienie godzin. Zamiast 2 godzin w Gicie, Slacku i Jirze: raport per ticket i eksport CSV do faktury jednym kliknięciem. Dla programistów na B2B. Link w bio.
`#b2b #jdg #programista #faktura #freelance #it`

**invoice · EN**
Last day of the month and the client wants your hours. Skip 2 hours of digging through Git, Slack and Jira: a report per ticket and a CSV for your invoice in one click. Link in bio.
`#freelancer #contractor #developer #timesheet #devtools`

