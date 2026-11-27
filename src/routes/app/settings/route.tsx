import { useEffect, useRef } from 'react'
import {
  Link,
  Outlet,
  createFileRoute,
  useRouterState,
} from '@tanstack/react-router'
import {
  settingsGroups,
  settingsSections,
} from '#/features/settings/domain/sections'
import { useMessages } from '#/i18n/context'
import { settingsMessages } from '#/i18n/messages/settings'

export const Route = createFileRoute('/app/settings')({
  component: SettingsLayout,
})

function SettingsLayout() {
  const t = useMessages(settingsMessages)
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const navRef = useRef<HTMLUListElement>(null)

  // Telefon: aktywna sekcja w poziomym pasku zawsze widoczna (bez animacji przy prefers-reduced-motion).
  useEffect(() => {
    const active = navRef.current?.querySelector<HTMLElement>(
      '[data-status="active"]',
    )
    if (
      !active ||
      !navRef.current ||
      navRef.current.scrollWidth <= navRef.current.clientWidth
    )
      return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    active.scrollIntoView({
      block: 'nearest',
      inline: 'center',
      behavior: reduce ? 'auto' : 'smooth',
    })
  }, [pathname])

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <nav
        aria-label={t.sectionsLabel}
        className="min-w-0 lg:sticky lg:top-10 lg:self-start"
      >
        <p className="mb-3 hidden text-sm font-semibold text-ink-soft lg:block">
          {t.title}
        </p>
        {/* Telefon/tablet: poziomy pasek przewijany palcem */}
        <ul
          ref={navRef}
          className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 lg:hidden"
        >
          {settingsSections.map(({ to, key, icon: Icon, exact }) => (
            <li key={to} className="shrink-0">
              <Link
                to={to}
                activeOptions={{ exact }}
                className="group flex items-center gap-3 rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink-soft hover:bg-muted hover:text-ink data-[status=active]:border-transparent data-[status=active]:bg-[var(--selected)] data-[status=active]:text-[var(--on-selected)] lg:border-transparent lg:py-2.5"
              >
                <Icon aria-hidden className="size-4 shrink-0" />
                <span className="flex flex-col">
                  <span>{t.sections[key].title}</span>
                  <span className="hidden text-xs font-normal text-ink-soft group-data-[status=active]:text-[var(--on-selected)]/75 lg:block">
                    {t.sections[key].text}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {/* Komputer: pionowa lista z opisami, w grupach */}
        <div className="hidden space-y-5 lg:block">
          {settingsGroups.map((group) => (
            <div key={group}>
              {group !== 'start' && (
                <p
                  id={`settings-group-${group}`}
                  className="mb-1.5 px-3 text-xs font-medium text-ink-faint"
                >
                  {t.groups[group]}
                </p>
              )}
              <ul
                aria-labelledby={
                  group !== 'start' ? `settings-group-${group}` : undefined
                }
                className="flex flex-col gap-0.5"
              >
                {settingsSections
                  .filter((x) => x.group === group)
                  .map(({ to, key, icon: Icon, exact }) => (
                    <li key={to}>
                      <Link
                        to={to}
                        activeOptions={{ exact }}
                        className="group flex items-center gap-3 rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink-soft hover:bg-muted hover:text-ink data-[status=active]:border-transparent data-[status=active]:bg-[var(--selected)] data-[status=active]:text-[var(--on-selected)] lg:border-transparent lg:py-2.5"
                      >
                        <Icon aria-hidden className="size-4 shrink-0" />
                        <span className="flex flex-col">
                          <span>{t.sections[key].title}</span>
                          <span className="hidden text-xs font-normal text-ink-soft group-data-[status=active]:text-[var(--on-selected)]/75 lg:block">
                            {t.sections[key].text}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </nav>
      <div className="min-w-0">
        <Outlet />
      </div>
    </div>
  )
}
