import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { database } from '#/server/db/client'
import { userSettings, users, workspaceSettings } from '#/server/db/schema'
import { outbox } from '#/server/email'
import { runReminders } from '#/server/reminders'
import { registered } from './helpers'
import type { ApiClient } from './helpers'

const reminders = (to: string) =>
  outbox.filter(
    (email) => email.to === to && /Log today’s work/.test(email.subject),
  )

/** Przypomnienie ustawione bezpośrednio w bazie (z pominięciem blokady planu w API). */
async function remindAt(apiClient: ApiClient, time: string) {
  const me = await apiClient.get<{ id: string }>('/account')
  await database
    .update(userSettings)
    .set({ dailyReminderAt: time, timezone: 'UTC' })
    .where(eq(userSettings.userId, me.body.id))
  await database
    .update(workspaceSettings)
    .set({ workingDays: [0, 1, 2, 3, 4, 5, 6], workdayTargetMinutes: 480 })
    .where(eq(workspaceSettings.userId, me.body.id))
  return me.body.id
}

describe('daily reminder email', () => {
  it('Should come once a day after the set time when the day is not full', async () => {
    const { apiClient, email } = await registered('en', { pro: true })
    await remindAt(apiClient, '17:00')

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

  it('Should not send reminders on the Free plan, even one set earlier', async () => {
    const { apiClient, email } = await registered()
    const id = await remindAt(apiClient, '17:00')
    await runReminders(new Date('2031-03-05T17:05:00Z'))
    expect(reminders(email)).toHaveLength(0)

    await database.update(users).set({ plan: 'pro' }).where(eq(users.id, id))
    await runReminders(new Date('2031-03-05T17:06:00Z'))
    expect(reminders(email)).toHaveLength(1)
  })
})
