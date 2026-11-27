import { Trash2 } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { Field } from '#/components/ui/controls'
import { Dialog, DialogContent } from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import type { User } from '#/features/auth/data/dto'
import { useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { appMessages } from '#/i18n/messages/app'
import { settingsMessages } from '#/i18n/messages/settings'
import { SettingsCard } from '#/features/settings/views/ui'
import { DELETE_CODE_LENGTH } from '../domain/account-forms'
import { useDeleteAccountViewModel } from '../controllers/use-delete-account'
import type { DeleteAccountViewModel } from '../controllers/use-delete-account'

export interface DeleteAccountCardProps {
  user: User
}

/** Strefa zagrożenia: usunięcie konta kodem wysłanym na adres konta. */
export function DeleteAccountCard({ user }: DeleteAccountCardProps) {
  const t = useMessages(settingsMessages).account
  const vm = useDeleteAccountViewModel(user)
  return (
    <SettingsCard title={t.dangerTitle} lead={t.dangerLead} tone="danger">
      <Button variant="destructive" onClick={vm.openDialog}>
        <Trash2 aria-hidden className="size-4" />
        {t.deleteButton}
      </Button>
      {vm.open && <DeleteAccountDialog vm={vm} />}
    </SettingsCard>
  )
}

interface DeleteAccountDialogProps {
  vm: DeleteAccountViewModel
}

/** Krok 1: wysłanie kodu. Krok 2: kod z e-maila i ostateczne usunięcie. */
function DeleteAccountDialog({ vm }: DeleteAccountDialogProps) {
  const t = useMessages(settingsMessages).account
  const app = useMessages(appMessages)
  return (
    <Dialog open onOpenChange={(open) => !open && vm.close()}>
      <DialogContent
        size="sm"
        title={t.deleteTitle}
        description={fmt(vm.codeSent ? t.codeSent : t.deleteText, {
          email: vm.email,
        })}
        closeLabel={app.actions.close}
        footer={
          <>
            <Button variant="outline" onClick={vm.close}>
              {app.actions.cancel}
            </Button>
            {vm.codeSent ? (
              <Button
                type="submit"
                form="delete-account-form"
                variant="destructive"
                disabled={vm.deleting}
                aria-busy={vm.deleting}
              >
                {t.deleteConfirm}
              </Button>
            ) : (
              <Button
                disabled={vm.sending}
                aria-busy={vm.sending}
                onClick={vm.sendCode}
              >
                {t.sendCode}
              </Button>
            )}
          </>
        }
      >
        {vm.codeSent && (
          <form id="delete-account-form" noValidate onSubmit={vm.submit}>
            <Field label={t.codeLabel} error={vm.codeError}>
              {(a) => (
                <Input
                  {...a}
                  autoFocus
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={DELETE_CODE_LENGTH}
                  className="max-w-40 font-mono text-lg tracking-[0.3em]"
                  value={vm.code}
                  onChange={(e) => vm.setCode(e.target.value)}
                />
              )}
            </Field>
            <Button
              type="button"
              variant="link"
              className="mt-2 h-auto px-0"
              disabled={vm.sending}
              onClick={vm.sendCode}
            >
              {t.resendCode}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
