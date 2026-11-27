import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { db } from '#/server/db/client'
import { userSettings } from '#/server/db/schema'
import { outbox } from '#/server/email'
import { runReminders } from '#/server/reminders'
import { registered } from './helpers'

const reminders = (to: string) =>
  outbox.filter((m) => m.to === to && /Log today’s work/.test(m.subject))

describe('daily reminder email', () => {
  it('Should come once a day after the set time when the day is not full', async () => {
    const { c, email } = await registered()
    const me = await c.get<{ id: string }>('/account')
    await db
      .update(userSettings)
      .set({
        dailyReminderAt: '17:00',
        timezone: 'UTC',
        workingDays: [0, 1, 2, 3, 4, 5, 6],
        workdayTargetMinutes: 480,
      })
      .where(eq(userSettings.userId, me.body.id))

    // Przed godziną nic, po godzinie jeden e-mail, drugi raz tego dnia już nie.
    await runReminders(new Date('2031-03-03T16:50:00Z'))
    expect(reminders(email)).toHaveLength(0)
    await runReminders(new Date('2031-03-03T17:05:00Z'))
    expect(reminders(email)).toHaveLength(1)
    expect(reminders(email)[0]!.text).toContain('0m of 8h')
    await runReminders(new Date('2031-03-03T17:20:00Z'))
    expect(reminders(email)).toHaveLength(1)

    // Kilka godzin po czasie (np. serwer stał) przypomnienie już nie przychodzi.
    await runReminders(new Date('2031-03-04T23:30:00Z'))
    expect(reminders(email)).toHaveLength(1)
  })
})
