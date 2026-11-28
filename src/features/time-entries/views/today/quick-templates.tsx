import { UseTemplateDialog } from '../../controllers/use-template-dialog'
import { ScheduledToday } from './scheduled-today'
import { useQuickTemplatesViewModel } from '../../controllers/use-quick-templates'

/** Szybkie szablony nad formularzem i zaplanowane na dziś spotkania. */
export function QuickTemplates(
  props: Parameters<typeof useQuickTemplatesViewModel>[0],
) {
  const viewModel = useQuickTemplatesViewModel(props)
  const { t: messages, format } = viewModel
  if (viewModel.templates.length === 0) return null
  return (
    <>
      <ScheduledToday viewModel={viewModel} />
      <section aria-labelledby="quick-templates" className="mb-6">
        <h2
          id="quick-templates"
          className="mb-2 text-sm font-medium text-ink-soft"
        >
          {messages.templates.title}
        </h2>
        <ul className="flex flex-wrap gap-2">
          {viewModel.templates.map((template) => (
            <li key={template.id}>
              <button
                type="button"
                disabled={viewModel.busy}
                onClick={() => viewModel.use(template)}
                aria-haspopup={template.askProject ? 'dialog' : undefined}
                aria-keyshortcuts={
                  template.hotkey ? `Alt+${template.hotkey}` : undefined
                }
                className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface pr-2 pl-3.5 text-sm font-medium hover:border-ink/40 disabled:opacity-60"
              >
                <span
                  aria-hidden
                  className="size-2.5 rounded-full"
                  style={{
                    background: viewModel.typeOf(template.taskTypeId)?.color,
                  }}
                />
                {template.label}
                {template.askProject && (
                  <span className="sr-only">
                    ({messages.templates.anyProject})
                  </span>
                )}
                <span className="text-ink-soft">
                  {template.defaultDurationMinutes
                    ? format.minutes(template.defaultDurationMinutes)
                    : viewModel.isToday
                      ? messages.form.timeModes.timer
                      : messages.templates.duration}
                </span>
                {template.hotkey && (
                  <kbd className="rounded-md border border-b-2 border-line px-1.5 py-0.5 font-sans text-xs text-ink-soft">
                    Alt+{template.hotkey}
                  </kbd>
                )}
              </button>
            </li>
          ))}
        </ul>
        {viewModel.picking && (
          <UseTemplateDialog
            template={viewModel.picking.template}
            type={viewModel.typeOf(viewModel.picking.template.taskTypeId)}
            projects={viewModel.projects}
            isToday={viewModel.isToday}
            pending={viewModel.busy}
            onSubmit={viewModel.submitPicked}
            onClose={viewModel.closePicker}
          />
        )}
      </section>
    </>
  )
}
