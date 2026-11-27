# Bezpieczeństwo / Security

## Zgłaszanie podatności / Reporting a vulnerability

Nie zakładaj publicznego zgłoszenia (issue). Napisz przez
[GitHub Private Vulnerability Reporting](https://github.com/AdamCygan/splits/security/advisories/new)
albo na adres z `/.well-known/security.txt` na stronie produkcyjnej. Odpowiadamy w ciągu
5 dni roboczych, a poprawkę krytycznej podatności wdrażamy w ciągu 14 dni.

Please do not open a public issue. Report privately through
[GitHub Private Vulnerability Reporting](https://github.com/AdamCygan/splits/security/advisories/new)
or the address in `/.well-known/security.txt` on the production site. We reply within
5 working days and ship fixes for critical issues within 14 days.

Opisz, co się dzieje, jak to powtórzyć i jaki jest skutek. Testuj tylko na własnym koncie:
bez dostępu do cudzych danych, bez testów obciążeniowych i bez socjotechniki.

## Wspierane wersje / Supported versions

Wspierana jest tylko bieżąca wersja z gałęzi `main` (wdrażana automatycznie).

## Automatyczne kontrole / Automated checks

Każdy push i pull request przechodzi przez `.github/workflows/security.yml`:

| Kontrola | Co sprawdza |
| --- | --- |
| CodeQL (`security-extended`) | SAST kodu TypeScript: wstrzyknięcia, XSS, open redirect, kryptografia |
| Semgrep | SAST: reguły dla TypeScript, React, Node, Dockerfile, GitHub Actions i sekretów |
| ESLint (`eslint-plugin-security`) | niebezpieczne wzorce już w edytorze (eval, child_process, wyrażenia regularne podatne na ReDoS) |
| gitleaks | sekrety w całej historii gita |
| `pnpm audit` | znane podatności w zależnościach (wyjątki z uzasadnieniem w `pnpm-workspace.yaml`) |
| Dependency Review | nowe zależności z podatnościami w pull requestach |
| Dependabot | cotygodniowe aktualizacje npm, GitHub Actions i obrazu Dockera |

Wyniki CodeQL i Semgrep trafiają do zakładki **Security → Code scanning**.
