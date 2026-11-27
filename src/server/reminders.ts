import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import { todayIn, nowTimeIn, weekday } from '#/domain/dates'
import { formatMinutes } from '#/i18n/format'
import { db } from './db/client'
import { daysOff, timeEntries, userSettings, users } from './db/schema'
import { accountEmail, sendEmail } from './email'
import { serverEnv } from './env'

/** Przypomnienie przychodzi najpóźniej tyle po ustawionej godzinie (np. po przerwie serwera). */
const LATE_LIMIT_MINUTES = 180

const minutesOf = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return h! * 60 + m!
}

/**
 * Dzienne przypomnienie e-mailem (Ustawienia → Dzień pracy): o ustawionej godzinie
 * w dzień roboczy, jeśli wpisany czas jest mniejszy niż cel dnia. Najwyżej jedno dziennie,
 * nie w dzień wolny, tylko na potwierdzony adres.
 */
export async function runReminders(now = new Date()) {
  const rows = await db
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
      ),
    )
  let sent = 0
  for (const { user, settings } of rows) {
    const zone = settings.timezone
    const today = todayIn(zone, now)
    if (settings.reminderSentOn === today) continue
    if (!settings.workingDays.includes(weekday(today))) continue
    const late =
      minutesOf(nowTimeIn(zone, now)) - minutesOf(settings.dailyReminderAt!)
    if (late < 0 || late > LATE_LIMIT_MINUTES) continue
    // Od tej chwili ten dzień jest załatwiony, niezależnie od tego, czy e-mail jest potrzebny.
    const [claimed] = await db
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
    const [off] = await db
      .select({ id: daysOff.id })
      .from(daysOff)
      .where(and(eq(daysOff.userId, user.id), eq(daysOff.date, today)))
    if (off) continue
    const [{ logged } = { logged: 0 }] = await db
      .select({
        logged: sql<number>`coalesce(sum(${timeEntries.durationMinutes}), 0)::int`,
      })
      .from(timeEntries)
      .where(
        and(eq(timeEntries.userId, user.id), eq(timeEntries.workDate, today)),
      )
    if (logged >= settings.workdayTargetMinutes) continue
    const locale = settings.locale === 'pl' ? 'pl' : 'en'
    await sendEmail(
      accountEmail('reminder', locale, user.email, {
        name: user.displayName,
        logged: formatMinutes(locale, logged),
        target: formatMinutes(locale, settings.workdayTargetMinutes),
        link: `${serverEnv.appUrl}/app`,
      }),
    )
    sent += 1
  }
  return { sent }
}
