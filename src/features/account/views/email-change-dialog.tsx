import { Button } from '#/components/ui/button'
import { Field } from '#/components/ui/controls'
import { Dialog, DialogContent } from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { useMessages } from '#/i18n/context'
import { appMessages } from '#/i18n/messages/app'
import { settingsMessages } from '#/i18n/messages/settings'
import { IdentityFields } from './identity-fields'
import type { EmailViewModel } from '../controllers/use-email'

export interface EmailChangeDialogProps {
  vm: EmailViewModel
}

/** Nowy adres + potwierdzenie tożsamości; serwer wysyła link na nowy adres. */
export function EmailChangeDialog({ vm }: EmailChangeDialogProps) {
  const t = useMessages(settingsMessages)
  const app = useMessages(appMessages)
  return (
    <Dialog open onOpenChange={(open) => !open && vm.close()}>
      <DialogContent
        size="sm"
        title={t.account.changeEmailTitle}
        description={t.account.changeEmailLead}
        closeLabel={app.actions.close}
        footer={
          <>
            <Button variant="outline" onClick={vm.close}>
              {app.actions.cancel}
            </Button>
            <Button
              type="submit"
              form="email-change-form"
              disabled={vm.sending}
              aria-busy={vm.sending}
            >
              {t.account.sendLink}
            </Button>
          </>
        }
      >
        <form
          id="email-change-form"
          noValidate
          onSubmit={vm.submit}
          className="space-y-4"
        >
          <Field label={t.security.newEmail} error={vm.errors.email}>
            {(a) => (
              <Input
                {...a}
                type="email"
                autoComplete="email"
                value={vm.draft.email}
                onChange={(e) => vm.update({ email: e.target.value })}
              />
            )}
          </Field>
          <IdentityFields
            needsPassword={vm.needsPassword}
            needsCode={vm.needsCode}
            password={vm.draft.password}
            code={vm.draft.code}
            onPassword={(password) => vm.update({ password })}
            onCode={(code) => vm.update({ code })}
            passwordError={vm.errors.password}
            codeError={vm.errors.code}
          />
        </form>
      </DialogContent>
    </Dialog>
  )
}
