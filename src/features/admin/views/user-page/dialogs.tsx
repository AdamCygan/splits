import { Button } from '#/components/ui/button'
import { Field, Textarea } from '#/components/ui/controls'
import { ConfirmDialog, Dialog, DialogContent } from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { adminMessages } from '#/i18n/messages/admin'
import { appMessages } from '#/i18n/messages/app'
import type { SectionProps } from './account-section'

/** Potwierdzenia: blokada, wyłączenie 2FA (z powodem) i usunięcie (z adresem konta). */
export function UserDialogs({ viewModel }: SectionProps) {
  const messages = useMessages(adminMessages)
  const app = useMessages(appMessages)
  const user = viewModel.user
  if (!user) return null
  const name = user.displayName
  const close = (open: boolean) => !open && viewModel.closeDialog()
  return (
    <>
      <ConfirmDialog
        open={viewModel.dialog === 'block'}
        onOpenChange={close}
        title={fmt(messages.confirmBlock.title, { name })}
        description={messages.confirmBlock.text}
        confirmLabel={messages.user.account.block}
        cancelLabel={app.actions.cancel}
        destructive
        busy={viewModel.blocking}
        onConfirm={viewModel.block}
      />

      <Dialog open={viewModel.dialog === 'twoFactor'} onOpenChange={close}>
        <DialogContent
          size="sm"
          title={fmt(messages.user.security.disable2faTitle, { name })}
          description={messages.user.security.disable2faText}
          closeLabel={app.actions.close}
          footer={
            <>
              <Button variant="outline" onClick={viewModel.closeDialog}>
                {app.actions.cancel}
              </Button>
              <Button
                type="submit"
                form="disable-2fa-form"
                variant="destructive"
                disabled={viewModel.disabling}
                aria-busy={viewModel.disabling}
              >
                {messages.user.security.disable2fa}
              </Button>
            </>
          }
        >
          <form
            id="disable-2fa-form"
            noValidate
            onSubmit={viewModel.submitTwoFactor}
          >
            <Field
              label={messages.user.security.reason}
              hint={messages.user.security.reasonHint}
              error={viewModel.reasonError}
            >
              {(fieldProps) => (
                <Textarea
                  {...fieldProps}
                  rows={3}
                  maxLength={300}
                  value={viewModel.reason}
                  onChange={(event) => viewModel.setReason(event.target.value)}
                />
              )}
            </Field>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={viewModel.dialog === 'delete'} onOpenChange={close}>
        <DialogContent
          size="sm"
          title={fmt(messages.user.danger.confirmTitle, { name })}
          description={messages.user.danger.confirmText}
          closeLabel={app.actions.close}
          footer={
            <>
              <Button variant="outline" onClick={viewModel.closeDialog}>
                {app.actions.cancel}
              </Button>
              <Button
                type="submit"
                form="delete-user-form"
                variant="destructive"
                disabled={
                  viewModel.deleting ||
                  viewModel.confirmEmail.trim().toLowerCase() !==
                    user.email.toLowerCase()
                }
                aria-busy={viewModel.deleting}
              >
                {messages.user.danger.button}
              </Button>
            </>
          }
        >
          <form
            id="delete-user-form"
            noValidate
            onSubmit={viewModel.submitDelete}
          >
            <Field
              label={messages.user.danger.confirmLabel}
              hint={user.email}
              error={viewModel.confirmError}
            >
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  type="email"
                  autoComplete="off"
                  value={viewModel.confirmEmail}
                  onChange={(event) =>
                    viewModel.setConfirmEmail(event.target.value)
                  }
                />
              )}
            </Field>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
