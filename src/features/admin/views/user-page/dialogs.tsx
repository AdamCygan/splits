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
export function UserDialogs({ vm }: SectionProps) {
  const t = useMessages(adminMessages)
  const app = useMessages(appMessages)
  const u = vm.user
  if (!u) return null
  const name = u.displayName
  const close = (open: boolean) => !open && vm.closeDialog()
  return (
    <>
      <ConfirmDialog
        open={vm.dialog === 'block'}
        onOpenChange={close}
        title={fmt(t.confirmBlock.title, { name })}
        description={t.confirmBlock.text}
        confirmLabel={t.user.account.block}
        cancelLabel={app.actions.cancel}
        destructive
        busy={vm.blocking}
        onConfirm={vm.block}
      />

      <Dialog open={vm.dialog === 'twoFactor'} onOpenChange={close}>
        <DialogContent
          size="sm"
          title={fmt(t.user.security.disable2faTitle, { name })}
          description={t.user.security.disable2faText}
          closeLabel={app.actions.close}
          footer={
            <>
              <Button variant="outline" onClick={vm.closeDialog}>
                {app.actions.cancel}
              </Button>
              <Button
                type="submit"
                form="disable-2fa-form"
                variant="destructive"
                disabled={vm.disabling}
                aria-busy={vm.disabling}
              >
                {t.user.security.disable2fa}
              </Button>
            </>
          }
        >
          <form id="disable-2fa-form" noValidate onSubmit={vm.submitTwoFactor}>
            <Field
              label={t.user.security.reason}
              hint={t.user.security.reasonHint}
              error={vm.reasonError}
            >
              {(a) => (
                <Textarea
                  {...a}
                  rows={3}
                  maxLength={300}
                  value={vm.reason}
                  onChange={(e) => vm.setReason(e.target.value)}
                />
              )}
            </Field>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={vm.dialog === 'delete'} onOpenChange={close}>
        <DialogContent
          size="sm"
          title={fmt(t.user.danger.confirmTitle, { name })}
          description={t.user.danger.confirmText}
          closeLabel={app.actions.close}
          footer={
            <>
              <Button variant="outline" onClick={vm.closeDialog}>
                {app.actions.cancel}
              </Button>
              <Button
                type="submit"
                form="delete-user-form"
                variant="destructive"
                disabled={
                  vm.deleting ||
                  vm.confirmEmail.trim().toLowerCase() !== u.email.toLowerCase()
                }
                aria-busy={vm.deleting}
              >
                {t.user.danger.button}
              </Button>
            </>
          }
        >
          <form id="delete-user-form" noValidate onSubmit={vm.submitDelete}>
            <Field
              label={t.user.danger.confirmLabel}
              hint={u.email}
              error={vm.confirmError}
            >
              {(a) => (
                <Input
                  {...a}
                  type="email"
                  autoComplete="off"
                  value={vm.confirmEmail}
                  onChange={(e) => vm.setConfirmEmail(e.target.value)}
                />
              )}
            </Field>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
