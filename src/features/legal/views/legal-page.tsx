import { fillLegal, legalDocs, legalPaths } from '../domain/legal-paths'
import type { LegalBlock, LegalDoc, LegalDocId } from '../domain/types'
import { Link } from '@tanstack/react-router'
import { legal } from '#/config/legal'
import { useI18n, useMessages } from '#/i18n/context'
import { fmt, formatDate } from '#/i18n/format'
import { commonMessages } from '#/i18n/messages/common'
import { Fragment } from 'react'
import type { ReactNode } from 'react'

interface InlineProps {
  text: string
}

/** Minimalny markdown w treści dokumentów: **pogrubienie** i [link](/ścieżka albo https://…). */
function Inline({ text }: InlineProps) {
  const parts: Array<ReactNode> = []
  const pattern = /\*\*(.+?)\*\*|\[(.+?)\]\((.+?)\)/g
  let last = 0
  for (const match of text.matchAll(pattern)) {
    const [whole, boldText, linkLabel, linkTarget] = match
    const hasTextBefore = match.index > last
    const isInternalLink = linkTarget?.startsWith('/')
    if (hasTextBefore) parts.push(text.slice(last, match.index))
    if (boldText) parts.push(<strong key={match.index}>{boldText}</strong>)
    else if (isInternalLink)
      parts.push(
        <Link
          key={match.index}
          to={linkTarget}
          className="font-medium underline underline-offset-4"
        >
          {linkLabel}
        </Link>,
      )
    else
      parts.push(
        <a
          key={match.index}
          href={linkTarget}
          rel="noopener noreferrer"
          target="_blank"
          className="font-medium underline underline-offset-4"
        >
          {linkLabel}
        </a>,
      )
    last = match.index + whole.length
  }
  const hasTextAfter = last < text.length
  if (hasTextAfter) parts.push(text.slice(last))
  return <>{parts}</>
}

interface BlockProps {
  block: LegalBlock
  date: string
}

function Block({ block, date }: BlockProps) {
  const fill = (template: string) => fillLegal(template, date)
  const isParagraph = typeof block === 'string'
  if (isParagraph)
    return (
      <p>
        <Inline text={fill(block)} />
      </p>
    )
  const isBulletList = 'ul' in block
  if (isBulletList)
    return (
      <ul className="list-disc space-y-1.5 pl-5">
        {block.ul.map((item) => (
          <li key={item}>
            <Inline text={fill(item)} />
          </li>
        ))}
      </ul>
    )
  const isNumberedList = 'ol' in block
  if (isNumberedList)
    return (
      <ol className="list-decimal space-y-1.5 pl-5">
        {block.ol.map((item) => (
          <li key={item}>
            <Inline text={fill(item)} />
          </li>
        ))}
      </ol>
    )
  return (
    <div
      className="relative overflow-x-auto rounded-xl border border-line"
      tabIndex={0}
      role="region"
      aria-label={block.table.head.join(', ')}
    >
      <table className="w-full min-w-[36rem] text-left text-sm">
        <thead className="bg-muted/60">
          <tr>
            {block.table.head.map((heading) => (
              <th
                key={heading}
                scope="col"
                className="px-3 py-2.5 font-semibold"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.table.rows.map((row) => (
            <tr key={row.join('|')} className="border-t border-line align-top">
              {row.map((cell, index) => (
                <td
                  key={index}
                  className={
                    index === 0
                      ? 'px-3 py-2.5 font-medium'
                      : 'px-3 py-2.5 text-ink-soft'
                  }
                >
                  <Inline text={fill(cell)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export interface LegalPageProps {
  id: LegalDocId
}

/** Strona dokumentu prawnego: tytuł, data wersji, spis treści, sekcje i linki do pozostałych dokumentów. */
export function LegalPage({ id }: LegalPageProps) {
  const { locale } = useI18n()
  const messages = useMessages(commonMessages).legal
  const legalDocument: LegalDoc = legalDocs[id][locale]
  const date = formatDate(
    locale,
    legalDocument.updated ?? legal.effectiveDate,
    {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    },
  )
  const others = (Object.keys(legalPaths) as Array<LegalDocId>).filter(
    (part) => part !== id,
  )

  return (
    <article className="mx-auto max-w-3xl px-4 pt-12 pb-20 sm:px-6">
      <header className="border-b border-line pb-6">
        <h1 className="type-display text-[clamp(2.5rem,6vw,3.75rem)]">
          {legalDocument.title}
        </h1>
        <p className="mt-3 text-ink-soft">
          {fillLegal(legalDocument.summary, date)}
        </p>
        <p className="mt-2 text-sm text-ink-soft">
          {legalDocument.updated
            ? fmt(messages.reviewed, { date })
            : fmt(messages.updated, { date, version: legal.version })}
        </p>
      </header>

      <nav
        aria-labelledby="legal-toc"
        className="mt-6 rounded-xl border border-line bg-surface p-4"
      >
        <h2 id="legal-toc" className="text-sm font-semibold">
          {messages.contents}
        </h2>
        <ol className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
          {legalDocument.sections.map((legalSection) => (
            <li key={legalSection.id}>
              <a
                href={`#${legalSection.id}`}
                className="text-ink-soft underline-offset-4 hover:text-ink hover:underline"
              >
                {legalSection.heading}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-10 space-y-10 leading-relaxed">
        {legalDocument.sections.map((section) => (
          <section
            key={section.id}
            id={section.id}
            aria-labelledby={`${section.id}-h`}
            className="scroll-mt-24 space-y-3"
          >
            <h2 id={`${section.id}-h`} className="type-heading text-2xl">
              {section.heading}
            </h2>
            {section.blocks.map((block, index) => (
              <Fragment key={index}>
                <Block block={block} date={date} />
              </Fragment>
            ))}
          </section>
        ))}
      </div>

      <footer className="mt-14 border-t border-line pt-6">
        <h2 className="text-sm font-semibold">{messages.otherDocs}</h2>
        <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
          {others.map((other) => (
            <li key={other}>
              <Link
                to={legalPaths[other]}
                className="font-medium underline underline-offset-4"
              >
                {legalDocs[other][locale].title}
              </Link>
            </li>
          ))}
        </ul>
      </footer>
    </article>
  )
}
