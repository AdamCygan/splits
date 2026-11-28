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
  const messages = useMessages(settingsMessages).account
  const viewModel = useDeleteAccountViewModel(user)
  return (
    <SettingsCard
      title={messages.dangerTitle}
      lead={messages.dangerLead}
      tone="danger"
    >
      <Button variant="destructive" onClick={viewModel.openDialog}>
        <Trash2 aria-hidden className="size-4" />
        {messages.deleteButton}
      </Button>
      {viewModel.open && <DeleteAccountDialog viewModel={viewModel} />}
    </SettingsCard>
  )
}

interface DeleteAccountDialogProps {
  viewModel: DeleteAccountViewModel
}

/** Krok 1: wysłanie kodu. Krok 2: kod z e-maila i ostateczne usunięcie. */
function DeleteAccountDialog({ viewModel }: DeleteAccountDialogProps) {
  const messages = useMessages(settingsMessages).account
  const app = useMessages(appMessages)
  return (
    <Dialog open onOpenChange={(open) => !open && viewModel.close()}>
      <DialogContent
        size="sm"
        title={messages.deleteTitle}
        description={fmt(
          viewModel.codeSent ? messages.codeSent : messages.deleteText,
          {
            email: viewModel.email,
          },
        )}
        closeLabel={app.actions.close}
        footer={
          <>
            <Button variant="outline" onClick={viewModel.close}>
              {app.actions.cancel}
            </Button>
            {viewModel.codeSent ? (
              <Button
                type="submit"
                form="delete-account-form"
                variant="destructive"
                disabled={viewModel.deleting}
                aria-busy={viewModel.deleting}
              >
                {messages.deleteConfirm}
              </Button>
            ) : (
              <Button
                disabled={viewModel.sending}
                aria-busy={viewModel.sending}
                onClick={viewModel.sendCode}
              >
                {messages.sendCode}
              </Button>
            )}
          </>
        }
      >
        {viewModel.codeSent && (
          <form id="delete-account-form" noValidate onSubmit={viewModel.submit}>
            <Field label={messages.codeLabel} error={viewModel.codeError}>
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  autoFocus
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={DELETE_CODE_LENGTH}
                  className="max-w-40 font-mono text-lg tracking-[0.3em]"
                  value={viewModel.code}
                  onChange={(event) => viewModel.setCode(event.target.value)}
                />
              )}
            </Field>
            <Button
              type="button"
              variant="link"
              className="mt-2 h-auto px-0"
              disabled={viewModel.sending}
              onClick={viewModel.sendCode}
            >
              {messages.resendCode}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
