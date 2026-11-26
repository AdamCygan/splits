import { Link } from '@tanstack/react-router'
import { ChevronsUpDown, LogOut, Search, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { shortcutLabel } from '#/features/commands/command-palette'
import { useConsent } from '#/features/legal/consent-context'
import { localeNames, locales } from '#/i18n/config'
import type { Locale } from '#/i18n/config'
import { useI18n, useMessages } from '#/i18n/context'
import { appMessages } from '#/i18n/messages/app'
import { commonMessages } from '#/i18n/messages/common'
import { clockPrefs, setClock, useClockPref } from '#/lib/clock'
import type { ClockPref } from '#/lib/clock'
import { setTheme, themes, useTheme } from '#/lib/theme'
import type { Theme } from '#/lib/theme'
import { cn } from '#/lib/utils'

const legalItem = 'px-1.5 py-1 text-xs font-normal text-ink-soft'

type User = { displayName: string; email: string }

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts.at(0) ?? '?'
  const last = parts.length > 1 ? (parts.at(-1) ?? '') : ''
  return (
    last ? first.charAt(0) + last.charAt(0) : first.slice(0, 2)
  ).toUpperCase()
}

function Avatar({ name, className }: { name: string; className?: string }) {
  // Inicjały jako treść CSS: to dekoracja, nie tekst etykiety przycisku (WCAG 2.5.3).
  return (
    <span
      aria-hidden
      data-initials={initials(name)}
      className={cn(
        'grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-ink before:content-[attr(data-initials)]',
        className,
      )}
    />
  )
}

/**
 * Menu konta: wszystko, co nie jest pracą (motyw, język, dokumenty, wylogowanie),
 * w jednym miejscu zamiast w stopce paska bocznego. `compact` to sam awatar (telefon).
 */
export function AccountMenu({
  user,
  onSignOut,
  onOpenCommands,
  compact = false,
}: {
  user: User
  onSignOut: () => void
  onOpenCommands?: () => void
  compact?: boolean
}) {
  const t = useMessages(appMessages)
  const common = useMessages(commonMessages)
  const { locale, setLocale } = useI18n()
  const theme = useTheme()
  const clock = useClockPref()
  const { openSettings } = useConsent()

  const trigger: ReactNode = compact ? (
    <button
      type="button"
      aria-label={t.menu.open}
      className="grid size-11 place-items-center rounded-full"
    >
      <Avatar name={user.displayName} />
    </button>
  ) : (
    <button
      type="button"
      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted data-[state=open]:bg-muted"
    >
      {/* Nazwa = widoczny tekst poprzedzony „Menu konta” (WCAG 2.5.3). */}
      <span className="sr-only">{t.menu.open}: </span>
      <Avatar name={user.displayName} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {user.displayName}
        </span>
        <span className="block truncate text-xs text-ink-soft">
          {user.email}
        </span>
      </span>
      <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-ink-soft" />
    </button>
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align={compact ? 'end' : 'start'}
        side={compact ? 'bottom' : 'top'}
        className="w-64"
      >
        {compact && (
          <>
            <div className="px-2.5 py-2">
              <p className="truncate text-sm font-medium">{user.displayName}</p>
              <p className="truncate text-xs text-ink-soft">{user.email}</p>
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem asChild>
          <Link to="/app/settings/account">
            <UserRound aria-hidden />
            {t.menu.settings}
          </Link>
        </DropdownMenuItem>
        {onOpenCommands && (
          <DropdownMenuItem onSelect={onOpenCommands}>
            <Search aria-hidden />
            <span className="flex-1">{t.menu.commands}</span>
            <kbd className="rounded border border-line px-1.5 text-[0.6875rem] text-ink-soft">
              {shortcutLabel()}
            </kbd>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t.menu.theme}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(v) => setTheme(v as Theme)}
        >
          {themes.map((th) => (
            <DropdownMenuRadioItem key={th} value={th}>
              {t.menu.themes[th]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t.menu.clock}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={clock}
          onValueChange={(v) => setClock(v as ClockPref)}
        >
          {clockPrefs.map((c) => (
            <DropdownMenuRadioItem key={c} value={c}>
              {t.menu.clocks[c]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t.menu.language}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={locale}
          onValueChange={(v) => void setLocale(v as Locale)}
        >
          {locales.map((l) => (
            <DropdownMenuRadioItem key={l} value={l} lang={l}>
              {localeNames[l]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <div className="flex flex-wrap px-1">
          <DropdownMenuItem asChild className={legalItem}>
            <Link to="/terms">{common.legal.terms}</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className={legalItem}>
            <Link to="/privacy">{common.legal.privacy}</Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={openSettings} className={legalItem}>
            {common.legal.cookieSettings}
          </DropdownMenuItem>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onSignOut}>
          <LogOut aria-hidden />
          {t.nav.logout}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
