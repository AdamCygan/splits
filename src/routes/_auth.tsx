import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
import { Logo } from '#/components/brand/logo'
import { LanguageSwitcher } from '#/components/layout/language-switcher'
import { useI18n, useMessages } from '#/i18n/context'
import { weekdayNames } from '#/i18n/format'
import { authMessages } from '#/i18n/messages/auth'
import { commonMessages } from '#/i18n/messages/common'

/** Layout logowania i rejestracji: formularz po lewej, motyw paska dnia po prawej. */
export const Route = createFileRoute('/_auth')({
  component: AuthLayout,
})

type Block = readonly ['task' | 'review' | 'pair' | 'extra' | 'meeting', number]

const week: ReadonlyArray<ReadonlyArray<Block>> = [
  [
    ['task', 46],
    ['review', 10],
    ['meeting', 8],
    ['pair', 20],
  ],
  [
    ['meeting', 4],
    ['task', 34],
    ['review', 7],
    ['pair', 15],
    ['extra', 10],
    ['task', 18],
  ],
  [
    ['task', 52],
    ['meeting', 12],
    ['review', 14],
    ['extra', 8],
  ],
  [
    ['meeting', 6],
    ['pair', 32],
    ['task', 30],
    ['review', 12],
  ],
  [
    ['task', 28],
    ['review', 18],
    ['extra', 16],
    ['meeting', 10],
  ],
]

const colors = {
  task: 'var(--wt-task)',
  review: 'var(--wt-review)',
  pair: 'var(--wt-pair)',
  extra: 'var(--wt-extra)',
  meeting: 'var(--wt-meeting)',
} as const

function AuthLayout() {
  const messages = useMessages(authMessages)
  const common = useMessages(commonMessages)
  const { locale } = useI18n()
  const days = weekdayNames(locale, 'short').slice(1, 6)

  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        {/* Nagłówek jako punkt orientacyjny: logo i język nie wiszą poza regionami strony. */}
        <header className="flex items-center justify-between gap-4">
          <Link
            to="/"
            aria-label={common.nav.home}
            className="w-fit rounded-md"
          >
            <Logo />
          </Link>
          <LanguageSwitcher />
        </header>
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto flex w-full max-w-sm flex-1 flex-col pt-10 pb-12 outline-none sm:justify-center sm:pt-12"
        >
          <Outlet />
        </main>
      </div>

      <aside
        className="hidden flex-col justify-between bg-[var(--ink-fixed)] p-12 text-white lg:flex"
        aria-hidden
      >
        <p className="type-display max-w-[14ch] text-5xl">{messages.aside}</p>
        <div className="space-y-3">
          {week.map((blocks, row) => (
            <div key={days[row]} className="flex items-center gap-4">
              <span className="w-10 text-sm text-white/70">{days[row]}</span>
              <div className="flex h-6 flex-1 gap-[3px] overflow-hidden rounded">
                {blocks.map(([kind, width], index) => (
                  <span
                    key={index}
                    style={{ width: `${width}%`, background: colors[kind] }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  )
}
