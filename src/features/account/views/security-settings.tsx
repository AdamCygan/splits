import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Copy,
  Download,
  KeyRound,
  LifeBuoy,
  LogOut,
  Monitor,
  ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { Badge, Field } from '#/components/ui/controls'
import { ConfirmDialog, Dialog, DialogContent } from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { site } from '#/config/site'
import type { SecurityStatus } from '#/features/account/data/dto'
import type { User } from '#/features/auth/data/dto'
import { useFormat, useI18n, useMessages } from '#/i18n/context'
import { fmt, formatDate } from '#/i18n/format'
import { appMessages } from '#/i18n/messages/app'
import { settingsMessages } from '#/i18n/messages/settings'
import { describeDevice } from '#/lib/user-agent'
import { meQuery, securityQuery } from '../data/queries'
import { mutationFieldError } from '#/shared/data/mutations'
import {
  useDevices,
  useTwoFactorActions,
  useTwoFactorSetup,
} from '../controllers/use-security'
import { IdentityFields, PasswordCard } from './index'
import {
  DemoNotice,
  QueryView,
  SectionHeader,
  SettingsCard,
} from '#/features/settings/views/ui'

/**
 * Ustawienia → Bezpieczeństwo (jeszcze bez trasy): hasło,
 * logowanie dwuetapowe (TOTP + kody zapasowe), zalogowane urządzenia, Google i pomoc.
 */
export function SecuritySettings() {
  const t = useMessages(settingsMessages)
  const me = useQuery(meQuery).data
  return (
    <div className="space-y-6">
      <SectionHeader
        title={t.sections.security.title}
        lead={t.sections.security.text}
      />
      {me?.isDemo ? (
        <DemoNotice />
      ) : (
        <QueryView query={securityQuery} skeletonRows={4}>
          {(security) =>
            me ? (
              <>
                <PasswordCard hasPassword={security.hasPassword} />
                <TwoFactorCard security={security} />
                <DevicesCard />
                <GoogleCard user={me} security={security} />
                <HelpCard user={me} />
              </>
            ) : null
          }
        </QueryView>
      )}
    </div>
  )
}

interface TwoFactorCardProps {
  security: SecurityStatus
}

function TwoFactorCard({ security }: TwoFactorCardProps) {
  const t = useMessages(settingsMessages).security
  const app = useMessages(appMessages)
  const format = useFormat()
  const [setup, setSetup] = useState(false)
  const [codes, setCodes] = useState<Array<string> | null>(null)
  const [confirm, setConfirm] = useState<'disable' | 'codes' | null>(null)
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const reset = () => {
    setConfirm(null)
    setPassword('')
    setCode('')
  }
  const { disable, regenerate } = useTwoFactorActions({
    onDone: reset,
    onNewCodes: setCodes,
  })
  const pending = confirm === 'disable' ? disable : regenerate

  return (
    <SettingsCard title={t.twoFactorTitle} lead={t.twoFactorLead}>
      {security.twoFactor ? (
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="success">
            <ShieldCheck aria-hidden className="size-3.5" />
            {t.on}
          </Badge>
          <span className="text-sm text-ink-soft">
            {format.plural(t.codesLeft, security.recoveryCodesLeft)}
          </span>
          <span className="flex flex-wrap gap-2 sm:ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirm('codes')}
            >
              <KeyRound aria-hidden className="size-4" />
              {t.newCodes}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirm('disable')}
            >
              {t.turnOff}
            </Button>
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="muted">{t.off}</Badge>
          <Button onClick={() => setSetup(true)}>
            <ShieldCheck aria-hidden className="size-4" />
            {t.turnOn}
          </Button>
        </div>
      )}

      {setup && (
        <SetupDialog
          security={security}
          onClose={() => setSetup(false)}
          onEnabled={(list) => {
            setSetup(false)
            setCodes(list)
          }}
        />
      )}
      {codes && <CodesDialog codes={codes} onClose={() => setCodes(null)} />}
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(next) => !next && reset()}
        title={confirm === 'disable' ? t.disableTitle : t.newCodesTitle}
        description={confirm === 'disable' ? t.disableText : t.newCodesText}
        confirmLabel={confirm === 'disable' ? t.turnOff : t.makeCodes}
        cancelLabel={app.actions.cancel}
        destructive={confirm === 'disable'}
        busy={pending.isPending || code.trim().length < 6}
        onConfirm={() => pending.mutate({ password, code })}
      >
        <div className="mt-4 space-y-4">
          <IdentityFields
            needsPassword={confirm === 'disable' && security.hasPassword}
            needsCode={security.twoFactor}
            password={password}
            code={code}
            onPassword={setPassword}
            onCode={setCode}
            passwordError={mutationFieldError(pending.error, 'password')}
            codeError={mutationFieldError(pending.error, 'code')}
          />
        </div>
      </ConfirmDialog>
    </SettingsCard>
  )
}

interface SetupDialogProps {
  security: SecurityStatus
  onClose: () => void
  onEnabled: (codes: Array<string>) => void
}

/** Włączanie 2FA: QR i klucz, potem kod z aplikacji (+ hasło); po sukcesie kody zapasowe. */
function SetupDialog({ security, onClose, onEnabled }: SetupDialogProps) {
  const t = useMessages(settingsMessages).security
  const app = useMessages(appMessages)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const { secret, qr, enable } = useTwoFactorSetup({
    hasPassword: security.hasPassword,
    onEnabled,
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title={t.setupTitle}
        description={t.setupScan}
        closeLabel={app.actions.close}
        footer={
          <>
            <Button variant="outline" onClick={onClose}>
              {app.actions.cancel}
            </Button>
            <Button
              type="submit"
              form="totp-setup"
              disabled={!secret || enable.isPending || code.trim().length < 6}
            >
              {t.setupConfirm}
            </Button>
          </>
        }
      >
        <form
          id="totp-setup"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            enable.mutate({ code, password })
          }}
          className="space-y-4"
        >
          <div className="flex flex-wrap items-start gap-5">
            <div className="size-[200px] shrink-0 overflow-hidden rounded-lg border border-line bg-white p-1">
              {qr && <img src={qr} alt={t.setupScan} className="size-full" />}
            </div>
            <div className="min-w-0 flex-1 basis-48">
              <p className="text-sm text-ink-soft">{t.setupManual}</p>
              <p className="mt-1 font-mono text-sm break-all select-all">
                {secret?.secret.replace(/(.{4})/g, '$1 ').trim()}
              </p>
            </div>
          </div>
          <Field
            label={t.setupCode}
            error={mutationFieldError(enable.error, 'code')}
          >
            {(a) => (
              <Input
                {...a}
                inputMode="numeric"
                autoComplete="one-time-code"
                className="max-w-48 font-mono tracking-widest"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            )}
          </Field>
          {security.hasPassword && (
            <Field
              label={t.password}
              error={mutationFieldError(enable.error, 'password')}
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
        </form>
      </DialogContent>
    </Dialog>
  )
}

interface CodesDialogProps {
  codes: Array<string>
  onClose: () => void
}

function CodesDialog({ codes, onClose }: CodesDialogProps) {
  const t = useMessages(settingsMessages).security
  const app = useMessages(appMessages)
  const text = codes.join('\n')
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title={t.codesTitle}
        description={t.codesLead}
        closeLabel={app.actions.close}
        footer={<Button onClick={onClose}>{t.codesDone}</Button>}
      >
        <ul className="grid grid-cols-2 gap-2 rounded-lg border border-line bg-muted/50 p-4 font-mono text-[0.9375rem]">
          {codes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              void navigator.clipboard
                .writeText(text)
                .then(() => toast.success(t.codesCopied))
            }
          >
            <Copy aria-hidden className="size-4" />
            {t.copyCodes}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const url = URL.createObjectURL(
                new Blob([text], { type: 'text/plain' }),
              )
              const a = document.createElement('a')
              a.href = url
              a.download = 'timeblame-backup-codes.txt'
              a.click()
              URL.revokeObjectURL(url)
            }}
          >
            <Download aria-hidden className="size-4" />
            {t.downloadCodes}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DevicesCard() {
  const t = useMessages(settingsMessages).security
  const { locale } = useI18n()
  const { sessions, revoke, others } = useDevices()
  const when = (iso: string) =>
    formatDate(locale, new Date(iso), {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })

  return (
    <SettingsCard title={t.devicesTitle} lead={t.devicesLead}>
      <ul className="divide-y divide-line rounded-lg border border-line">
        {sessions.map((s) => {
          const device = describeDevice(s.userAgent)
          const name = device ? fmt(t.deviceOn, device) : t.unknownDevice
          return (
            <li
              key={s.id}
              className="flex flex-wrap items-center gap-3 px-4 py-3"
            >
              <Monitor aria-hidden className="size-5 shrink-0 text-ink-soft" />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 font-medium">
                  {name}
                  {s.current && <Badge tone="info">{t.thisDevice}</Badge>}
                </span>
                <span className="block text-sm text-ink-soft">
                  {fmt(t.lastActive, { date: when(s.lastActiveAt) })}
                  {s.ip && <>, {s.ip}</>}
                  {', '}
                  {fmt(t.since, { date: when(s.startedAt) })}
                </span>
              </span>
              {!s.current && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={revoke.isPending}
                  aria-label={fmt(t.signOutNamed, { name })}
                  onClick={() => revoke.mutate(s.id)}
                >
                  <LogOut aria-hidden className="size-4" />
                  {t.signOut}
                </Button>
              )}
            </li>
          )
        })}
      </ul>
      {sessions.length > 1 && (
        <Button
          className="mt-4"
          variant="outline"
          disabled={others.isPending}
          onClick={() => others.mutate(undefined)}
        >
          {t.signOutOthers}
        </Button>
      )}
    </SettingsCard>
  )
}

interface GoogleCardProps {
  user: User
  security: SecurityStatus
}

function GoogleCard({ user, security }: GoogleCardProps) {
  const t = useMessages(settingsMessages).security
  return (
    <SettingsCard title={t.googleTitle}>
      <p className="text-[0.9375rem]">
        {fmt(security.google ? t.googleOn : t.googleOff, { email: user.email })}
      </p>
    </SettingsCard>
  )
}

interface HelpCardProps {
  user: User
}

function HelpCard({ user }: HelpCardProps) {
  const t = useMessages(settingsMessages).security
  const subject = encodeURIComponent(`Timeblame: ${user.id}`)
  return (
    <SettingsCard title={t.helpTitle}>
      <p className="text-[0.9375rem]">{fmt(t.helpText, { id: user.id })}</p>
      <a
        href={`mailto:${site.supportEmail}?subject=${subject}`}
        className="mt-3 inline-flex items-center gap-2 font-medium underline underline-offset-4"
      >
        <LifeBuoy aria-hidden className="size-4" />
        {t.helpButton}
      </a>
    </SettingsCard>
  )
}
