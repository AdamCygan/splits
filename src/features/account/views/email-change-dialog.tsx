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
  viewModel: EmailViewModel
}

/** Nowy adres + potwierdzenie tożsamości; serwer wysyła link na nowy adres. */
export function EmailChangeDialog({ viewModel }: EmailChangeDialogProps) {
  const messages = useMessages(settingsMessages)
  const app = useMessages(appMessages)
  return (
    <Dialog open onOpenChange={(open) => !open && viewModel.close()}>
      <DialogContent
        size="sm"
        title={messages.account.changeEmailTitle}
        description={messages.account.changeEmailLead}
        closeLabel={app.actions.close}
        footer={
          <>
            <Button variant="outline" onClick={viewModel.close}>
              {app.actions.cancel}
            </Button>
            <Button
              type="submit"
              form="email-change-form"
              disabled={viewModel.sending}
              aria-busy={viewModel.sending}
            >
              {messages.account.sendLink}
            </Button>
          </>
        }
      >
        <form
          id="email-change-form"
          noValidate
          onSubmit={viewModel.submit}
          className="space-y-4"
        >
          <Field
            label={messages.security.newEmail}
            error={viewModel.errors.email}
          >
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="email"
                autoComplete="email"
                value={viewModel.draft.email}
                onChange={(event) =>
                  viewModel.update({ email: event.target.value })
                }
              />
            )}
          </Field>
          <IdentityFields
            needsPassword={viewModel.needsPassword}
            needsCode={viewModel.needsCode}
            password={viewModel.draft.password}
            code={viewModel.draft.code}
            onPassword={(password) => viewModel.update({ password })}
            onCode={(code) => viewModel.update({ code })}
            passwordError={viewModel.errors.password}
            codeError={viewModel.errors.code}
          />
        </form>
      </DialogContent>
    </Dialog>
  )
}
