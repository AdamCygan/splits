import { Button } from '#/components/ui/button'
import { useMessages } from '#/i18n/context'
import { fmt } from '#/i18n/format'
import { adminMessages } from '#/i18n/messages/admin'

export interface PaginationProps {
  page: number
  pages: number
  onPage: (page: number) => void
}

/** Poprzednia / następna strona z numerem bieżącej (ukryte przy jednej stronie). */
export function Pagination({ page, pages, onPage }: PaginationProps) {
  const t = useMessages(adminMessages)
  if (pages <= 1) return null
  return (
    <nav aria-label={t.pagination} className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        {t.prev}
      </Button>
      <span className="tabular-nums">{fmt(t.page, { page, pages })}</span>
      <Button
        size="sm"
        variant="outline"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
      >
        {t.next}
      </Button>
    </nav>
  )
}
