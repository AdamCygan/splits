import { useMessages } from '#/i18n/context'
import { appMessages } from '#/i18n/messages/app'
import { settingsMessages } from '#/i18n/messages/settings'
import { useDataMutation } from '#/shared/data/mutations'
import { keys } from '#/shared/data/query-keys'
import { tagsApi } from '../data/api'
import type { Tag, TagInput } from '../data/dto'

export interface TagActionsOptions {
  onCreated: () => void
  onRemoved: () => void
}

/** Dodawanie i usuwanie tagów. */
export function useTagActions({ onCreated, onRemoved }: TagActionsOptions) {
  const t = useMessages(settingsMessages).projects
  const create = useDataMutation((input: TagInput) => tagsApi.create(input), {
    invalidate: [keys.tags],
    success: t.tagCreated,
    onSuccess: onCreated,
  })
  const remove = useDataMutation((id: string) => tagsApi.remove(id), {
    invalidate: [keys.tags],
    success: t.tagDeleted,
    onSuccess: onRemoved,
  })
  return { create, remove }
}

export interface SaveTagOptions {
  tag: Tag
  onSaved: () => void
}

/** Zmiana nazwy albo koloru tagu. */
export function useSaveTag({ tag, onSaved }: SaveTagOptions) {
  const app = useMessages(appMessages)
  return useDataMutation((input: TagInput) => tagsApi.update(tag.id, input), {
    invalidate: [keys.tags],
    success: app.status.saved,
    onSuccess: onSaved,
  })
}
