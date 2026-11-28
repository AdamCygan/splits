import { useState } from 'react'
import { PALETTE } from '#/features/task-types/domain/rules'
import { useMessages } from '#/i18n/context'
import { workspacesMessages } from '#/i18n/messages/workspaces'
import { mutationFieldError } from '#/shared/data/mutations'
import type { Workspace } from '../data/dto'
import {
  COPY_KINDS,
  DEFAULT_COPY,
  WORKSPACE_NAME_MAX,
} from '../domain/workspaces'
import type { CopyKind } from '../domain/workspaces'
import { useWorkspaceActions, useWorkspaces } from './use-workspaces'

export interface WorkspaceFormOptions {
  /** Edytowana przestrzeń albo null dla nowej. */
  workspace: Workspace | null
  onDone: () => void
}

/** Kolor nowej przestrzeni: pierwszy z palety, którego jeszcze nie używa żadna przestrzeń. */
const nextColor = (used: ReadonlyArray<string>) =>
  PALETTE.find((swatch) => !used.includes(swatch.value))?.value ??
  PALETTE[0].value

/**
 * Formularz przestrzeni: nazwa, kolor, a dla nowej także źródło kopii i co skopiować.
 * Nowa przestrzeń od razu staje się bieżącą.
 */
export function useWorkspaceForm({ workspace, onDone }: WorkspaceFormOptions) {
  const messages = useMessages(workspacesMessages).dialog
  const { items, current } = useWorkspaces()
  const actions = useWorkspaceActions()
  const [name, setName] = useState(workspace?.name ?? '')
  const [color, setColor] = useState(
    workspace?.color ?? nextColor(items.map((item) => item.color)),
  )
  const [copyFrom, setCopyFrom] = useState(workspace ? '' : (current?.id ?? ''))
  const [copy, setCopy] = useState<Array<CopyKind>>([...DEFAULT_COPY])
  const [submitted, setSubmitted] = useState(false)
  const pending = actions.create.isPending || actions.update.isPending
  const error = workspace ? actions.update.error : actions.create.error

  const trimmed = name.trim()
  const nameOk = trimmed.length > 0 && trimmed.length <= WORKSPACE_NAME_MAX
  const nameError = !submitted
    ? null
    : nameOk
      ? mutationFieldError(error, 'name')
      : messages.nameError

  const submit = () => {
    setSubmitted(true)
    if (!nameOk) return
    if (workspace) {
      actions.update.mutate(
        { id: workspace.id, input: { name: trimmed, color } },
        { onSuccess: onDone },
      )
      return
    }
    actions.create.mutate(
      {
        name: trimmed,
        color,
        copyFrom: copyFrom || null,
        copy: copyFrom ? copy : [],
      },
      {
        onSuccess: (created) => {
          onDone()
          void actions.switchTo(created)
        },
      },
    )
  }

  return {
    isNew: workspace === null,
    name,
    setName,
    color,
    setColor,
    copyFrom,
    setCopyFrom,
    copy,
    setCopy,
    sources: items,
    copyKinds: COPY_KINDS,
    nameError,
    pending,
    submit,
  }
}
