import { useApplyMutation } from '#/features/workspaces/controllers/use-apply-mutation'
import { useMessages } from '#/i18n/context'
import { appMessages } from '#/i18n/messages/app'
import { settingsMessages } from '#/i18n/messages/settings'
import { keys } from '#/shared/data/query-keys'
import { tagsApi } from '../data/api'
import type { Tag, TagInput } from '../data/dto'

export interface TagActionsOptions {
  onCreated: () => void
  onRemoved: () => void
}

/** Dodawanie i usuwanie tagów. */
export function useTagActions({ onCreated, onRemoved }: TagActionsOptions) {
  const messages = useMessages(settingsMessages).projects
  const create = useApplyMutation(
    'tags',
    (input: TagInput, apply) => tagsApi.create(input, apply),
    {
      invalidate: [keys.tags],
      success: messages.tagCreated,
      onSuccess: onCreated,
    },
  )
  const remove = useApplyMutation(
    'tags',
    (id: string, apply) => tagsApi.remove(id, apply),
    {
      invalidate: [keys.tags],
      success: messages.tagDeleted,
      onSuccess: onRemoved,
    },
  )
  return { create, remove }
}

export interface SaveTagOptions {
  tag: Tag
  onSaved: () => void
}

/** Zmiana nazwy albo koloru tagu. */
export function useSaveTag({ tag, onSaved }: SaveTagOptions) {
  const app = useMessages(appMessages)
  return useApplyMutation(
    'tags',
    (input: TagInput, apply) => tagsApi.update(tag.id, input, apply),
    {
      invalidate: [keys.tags],
      success: app.status.saved,
      onSuccess: onSaved,
    },
  )
}
