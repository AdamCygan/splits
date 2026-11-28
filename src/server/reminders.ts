import { and, eq, isNotNull, isNull, ne, or, sql } from 'drizzle-orm'
import { todayIn, nowTimeIn, weekday } from '#/shared/domain/dates'
import { formatMinutes } from '#/i18n/format'
import { database } from './db/client'
import {
  daysOff,
  timeEntries,
  userSettings,
  users,
  workspaceSettings,
} from './db/schema'
import { accountEmail, sendEmail } from './email'
import { serverEnv } from './env'

/** Przypomnienie przychodzi najpóźniej tyle po ustawionej godzinie (np. po przerwie serwera). */
const LATE_LIMIT_MINUTES = 180

const minutesOf = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number)
  return hours! * 60 + minutes!
}

/**
 * Dzienne przypomnienie e-mailem (Ustawienia → Dzień pracy): o ustawionej godzinie
 * w dzień roboczy, jeśli wpisany czas jest mniejszy niż cel dnia. Najwyżej jedno dziennie,
 * nie w dzień wolny, tylko na potwierdzony adres i tylko w planie Pro. Przy kilku przestrzeniach
 * cel dnia to suma celów przestrzeni, w których dziś jest dzień roboczy (i nie dzień wolny),
 * a wpisany czas to suma ze wszystkich przestrzeni.
 */
export async function runReminders(now = new Date()) {
  const rows = await database
    .select({
      user: users,
      settings: userSettings,
    })
    .from(userSettings)
    .innerJoin(users, eq(users.id, userSettings.userId))
    .where(
      and(
        isNotNull(userSettings.dailyReminderAt),
        isNotNull(users.emailVerifiedAt),
        isNull(users.disabledAt),
        eq(users.isDemo, false),
        // Przypomnienia są w Pro (administrator ma Pro bez opłat).
        or(ne(users.plan, 'free'), eq(users.role, 'admin')),
      ),
    )
  let sent = 0
  for (const { user, settings } of rows) {
    const zone = settings.timezone
    const today = todayIn(zone, now)
    const wasSentToday = settings.reminderSentOn === today
    if (wasSentToday) continue
    const days = await database
      .select({
        workspaceId: workspaceSettings.workspaceId,
        workingDays: workspaceSettings.workingDays,
        target: workspaceSettings.workdayTargetMinutes,
      })
      .from(workspaceSettings)
      .where(eq(workspaceSettings.userId, user.id))
    const working = days.filter((day) =>
      day.workingDays.includes(weekday(today)),
    )
    const hasNoWorkspaces = working.length === 0
    if (hasNoWorkspaces) continue
    const late =
      minutesOf(nowTimeIn(zone, now)) - minutesOf(settings.dailyReminderAt!)
    const isOutsideWindow = late < 0 || late > LATE_LIMIT_MINUTES
    if (isOutsideWindow) continue
    // Od tej chwili ten dzień jest załatwiony, niezależnie od tego, czy e-mail jest potrzebny.
    const [claimed] = await database
      .update(userSettings)
      .set({ reminderSentOn: today })
      .where(
        and(
          eq(userSettings.userId, user.id),
          sql`${userSettings.reminderSentOn} is distinct from ${today}`,
        ),
      )
      .returning({ userId: userSettings.userId })
    if (!claimed) continue
    const off = new Set(
      (
        await database
          .select({ workspaceId: daysOff.workspaceId })
          .from(daysOff)
          .where(and(eq(daysOff.userId, user.id), eq(daysOff.date, today)))
      ).map((dueUser) => dueUser.workspaceId),
    )
    const target = working
      .filter((dueUser) => !off.has(dueUser.workspaceId))
      .reduce((sum, dueUser) => sum + dueUser.target, 0)
    const hasNoTarget = target === 0
    if (hasNoTarget) continue
    const [{ logged } = { logged: 0 }] = await database
      .select({
        logged: sql<number>`coalesce(sum(${timeEntries.durationMinutes}), 0)::int`,
      })
      .from(timeEntries)
      .where(
        and(eq(timeEntries.userId, user.id), eq(timeEntries.workDate, today)),
      )
    const isTargetMet = logged >= target
    if (isTargetMet) continue
    const locale = settings.locale === 'pl' ? 'pl' : 'en'
    await sendEmail(
      accountEmail('reminder', locale, user.email, {
        name: user.displayName,
        logged: formatMinutes(locale, logged),
        target: formatMinutes(locale, target),
        link: `${serverEnv.appUrl}/app`,
      }),
    )
    sent += 1
  }
  return { sent }
}
