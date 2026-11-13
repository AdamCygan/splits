import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Download, Trash2 } from 'lucide-react'
import { z } from 'zod'
import { Button } from '#/components/ui/button'
import { Field } from '#/components/ui/controls'
import { ConfirmDialog } from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Segmented } from '#/components/ui/segmented'
import { data } from '#/data'
import type { ProfileInput, User } from '#/data/types'
import { LIMITS } from '#/domain/rules'
import { clearSession, setCurrentUser } from '#/features/auth/session'
import { passwordSchema } from '#/features/auth/schemas'
import { locales, localeNames } from '#/i18n/config'
import type { Locale } from '#/i18n/config'
import { useI18n, useMessages } from '#/i18n/context'
import { appMessages } from '#/i18n/messages/app'
import { authMessages } from '#/i18n/messages/auth'
import { panelMessages } from '#/i18n/messages/panel'
import { settingsMessages } from '#/i18n/messages/settings'
import {
  keys,
  meQuery,
  mutationFieldError,
  settingsQuery,
  useDataMutation,
} from '../queries'
import {
  DemoNotice,
  QueryView,
  SaveBar,
  SectionHeader,
  SettingsCard,
  useUnsavedWarning,
} from './ui'

export function AccountSettings() {
  const t = useMessages(settingsMessages)
  return (
    <div className="space-y-6">
      <SectionHeader
        title={t.sections.account.title}
        lead={t.sections.account.text}
      />
      <QueryView query={meQuery} skeletonRows={3}>
        {(user) => (
          <>
            {user.isDemo ? <DemoNotice /> : <Profile user={user} />}
            <Language />
            {!user.isDemo && <Password hasPassword={user.hasPassword} />}
            <ExportData />
            <DeleteAccount user={user} />
          </>
        )}
      </QueryView>
    </div>
  )
}

/** Pobranie wszystkich danych konta jako plik JSON (RODO: prawo do przenoszenia danych). */
function ExportData() {
  const t = useMessages(panelMessages).export
  const download = useDataMutation(() => data.account.exportData(), {
    invalidate: [],
    success: t.done,
    onSuccess: (payload) => {
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `splits-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    },
  })
  return (
    <SettingsCard title={t.title} lead={t.lead}>
      <Button
        variant="outline"
        disabled={download.isPending}
        aria-busy={download.isPending}
        onClick={() => download.mutate(undefined)}
      >
        <Download aria-hidden className="size-4" />
        {download.isPending ? t.busy : t.button}
      </Button>
    </SettingsCard>
  )
}

function Profile({ user }: { user: User }) {
  const t = useMessages(settingsMessages).account
  const [draft, setDraft] = useState<ProfileInput>({
    displayName: user.displayName,
    email: user.email,
  })
  const [submitted, setSubmitted] = useState(false)
  const save = useDataMutation(
    (input: ProfileInput) => data.account.updateProfile(input),
    {
      invalidate: [keys.me],
      success: t.profileSaved,
      onSuccess: (updated) => {
        setCurrentUser(updated)
        setSubmitted(false)
      },
    },
  )
  const nameOk =
    draft.displayName.trim().length > 0 &&
    draft.displayName.length <= LIMITS.displayName
  const emailOk = z.email().safeParse(draft.email.trim()).success
  const dirty =
    draft.displayName !== user.displayName || draft.email !== user.email
  useUnsavedWarning(dirty)

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (nameOk && emailOk)
      save.mutate({
        displayName: draft.displayName.trim(),
        email: draft.email.trim(),
      })
  }

  return (
    <form noValidate onSubmit={onSubmit}>
      <SettingsCard title={t.profileTitle} lead={t.profileLead}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t.username} hint={t.usernameHint}>
            {(a) => (
              <Input
                {...a}
                value={user.username}
                readOnly
                className="bg-muted/60"
              />
            )}
          </Field>
          <Field
            label={t.displayName}
            error={
              submitted
                ? nameOk
                  ? mutationFieldError(save.error, 'displayName')
                  : t.nameError
                : null
            }
          >
            {(a) => (
              <Input
                {...a}
                autoComplete="name"
                maxLength={LIMITS.displayName}
                value={draft.displayName}
                onChange={(e) =>
                  setDraft({ ...draft, displayName: e.target.value })
                }
              />
            )}
          </Field>
          <Field
            label={t.email}
            className="sm:col-span-2"
            error={
              submitted
                ? emailOk
                  ? mutationFieldError(save.error, 'email')
                  : t.emailError
                : null
            }
          >
            {(a) => (
              <Input
                {...a}
                type="email"
                autoComplete="email"
                className="sm:max-w-md"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              />
            )}
          </Field>
        </div>
      </SettingsCard>
      <SaveBar
        dirty={dirty}
        saving={save.isPending}
        onDiscard={() => {
          setDraft({ displayName: user.displayName, email: user.email })
          setSubmitted(false)
        }}
      />
    </form>
  )
}

function Language() {
  const t = useMessages(settingsMessages).account
  const { locale, setLocale } = useI18n()
  const settings = useQuery(settingsQuery).data
  const save = useDataMutation(
    (next: Locale) => data.settings.update({ ...settings!, locale: next }),
    { invalidate: [keys.settings] },
  )

  return (
    <SettingsCard title={t.languageTitle} lead={t.languageLead}>
      <Segmented<Locale>
        label={t.languageTitle}
        hideLabel
        value={locale}
        options={locales.map((l) => ({ value: l, label: localeNames[l] }))}
        onChange={(next) => {
          if (settings) save.mutate(next)
          void setLocale(next)
        }}
      />
    </SettingsCard>
  )
}

/** Konto założone przez Google nie ma hasła: pierwsze hasło ustawia się bez podawania obecnego. */
function Password({ hasPassword }: { hasPassword: boolean }) {
  const t = useMessages(settingsMessages).account
  const v = useMessages(authMessages).validation
  const [draft, setDraft] = useState({ current: '', next: '', confirm: '' })
  const [submitted, setSubmitted] = useState(false)
  const save = useDataMutation(data.account.changePassword, {
    invalidate: [],
    success: t.passwordSaved,
    onSuccess: () => {
      setDraft({ current: '', next: '', confirm: '' })
      setSubmitted(false)
    },
  })

  const nextIssue =
    passwordSchema(v).safeParse(draft.next).error?.issues[0]?.message ?? null
  const errors = {
    current:
      draft.current || !hasPassword
        ? mutationFieldError(save.error, 'currentPassword')
        : v.passwordRequired,
    next: nextIssue,
    confirm: draft.confirm === draft.next ? null : t.confirmError,
  }
  const show = (e: string | null) => (submitted ? e : null)

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        setSubmitted(true)
        if ((draft.current || !hasPassword) && !errors.next && !errors.confirm)
          save.mutate({
            currentPassword: draft.current,
            newPassword: draft.next,
          })
      }}
    >
      <SettingsCard
        title={hasPassword ? t.passwordTitle : t.setPasswordTitle}
        lead={hasPassword ? t.passwordLead : t.setPasswordLead}
      >
        <div className="grid max-w-md gap-5">
          {hasPassword && (
            <Field label={t.currentPassword} error={show(errors.current)}>
              {(a) => (
                <Input
                  {...a}
                  type="password"
                  autoComplete="current-password"
                  value={draft.current}
                  onChange={(e) =>
                    setDraft({ ...draft, current: e.target.value })
                  }
                />
              )}
            </Field>
          )}
          <Field label={t.newPassword} error={show(errors.next)}>
            {(a) => (
              <Input
                {...a}
                type="password"
                autoComplete="new-password"
                value={draft.next}
                onChange={(e) => setDraft({ ...draft, next: e.target.value })}
              />
            )}
          </Field>
          <Field label={t.confirmPassword} error={show(errors.confirm)}>
            {(a) => (
              <Input
                {...a}
                type="password"
                autoComplete="new-password"
                value={draft.confirm}
                onChange={(e) =>
                  setDraft({ ...draft, confirm: e.target.value })
                }
              />
            )}
          </Field>
          <Button
            type="submit"
            className="w-fit"
            disabled={save.isPending}
            aria-busy={save.isPending}
          >
            {t.changePassword}
          </Button>
        </div>
      </SettingsCard>
    </form>
  )
}

function DeleteAccount({ user }: { user: User }) {
  const t = useMessages(settingsMessages).account
  const app = useMessages(appMessages)
  const navigate = useNavigate()
  // Konto z Google bez hasła usuwa się bez potwierdzania hasłem.
  const demo = !user.hasPassword
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const remove = useDataMutation(
    (pw: string) => data.account.deleteAccount(pw),
    {
      invalidate: [],
      onSuccess: () => {
        clearSession()
        void navigate({ to: '/' })
      },
    },
  )
  const passwordError = mutationFieldError(remove.error, 'password')

  return (
    <SettingsCard title={t.dangerTitle} lead={t.dangerLead} tone="danger">
      <Button variant="destructive" onClick={() => setOpen(true)}>
        <Trash2 aria-hidden className="size-4" />
        {t.deleteButton}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setPassword('')
        }}
        title={t.deleteTitle}
        description={demo ? t.deleteTextDemo : t.deleteText}
        confirmLabel={t.deleteConfirm}
        cancelLabel={app.actions.cancel}
        destructive
        busy={remove.isPending || (!demo && password.length === 0)}
        onConfirm={() => remove.mutate(password)}
      >
        {!demo && (
          <Field
            label={t.currentPassword}
            error={passwordError}
            className="mt-4"
          >
            {(a) => (
              <Input
                {...a}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
          </Field>
        )}
      </ConfirmDialog>
    </SettingsCard>
  )
}
