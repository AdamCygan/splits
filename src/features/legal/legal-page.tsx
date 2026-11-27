import { Fragment } from 'react'
import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { LEGAL_PLACEHOLDERS, legal } from '#/config/legal'
import { useI18n, useMessages } from '#/i18n/context'
import { fmt, formatDate } from '#/i18n/format'
import { commonMessages } from '#/i18n/messages/common'
import { accessibilityDoc } from './accessibility'
import { cookiesDoc } from './cookies'
import { privacyDoc } from './privacy'
import { termsDoc } from './terms'
import type { LegalBlock, LegalDoc, LegalDocId } from './types'

export const legalDocs = {
  terms: termsDoc,
  privacy: privacyDoc,
  cookies: cookiesDoc,
  accessibility: accessibilityDoc,
} as const
export const legalPaths: Record<
  LegalDocId,
  '/terms' | '/privacy' | '/cookies' | '/accessibility'
> = {
  terms: '/terms',
  privacy: '/privacy',
  cookies: '/cookies',
  accessibility: '/accessibility',
}

/** {pole} → wartość z config/legal.ts; {date} = data wejścia w życie w języku strony. */
export function fillLegal(text: string, date: string) {
  return text.replace(/\{(\w+)\}/g, (match, key: string) =>
    key === 'date'
      ? date
      : ((LEGAL_PLACEHOLDERS as Record<string, string>)[key] ?? match),
  )
}

interface InlineProps {
  text: string
}

/** Minimalny markdown w treści dokumentów: **pogrubienie** i [link](/ścieżka albo https://…). */
function Inline({ text }: InlineProps) {
  const parts: Array<ReactNode> = []
  const re = /\*\*(.+?)\*\*|\[(.+?)\]\((.+?)\)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    if (m[1]) parts.push(<strong key={m.index}>{m[1]}</strong>)
    else if (m[3]?.startsWith('/'))
      parts.push(
        <Link
          key={m.index}
          to={m[3]}
          className="font-medium underline underline-offset-4"
        >
          {m[2]}
        </Link>,
      )
    else
      parts.push(
        <a
          key={m.index}
          href={m[3]}
          rel="noopener noreferrer"
          target="_blank"
          className="font-medium underline underline-offset-4"
        >
          {m[2]}
        </a>,
      )
    last = re.lastIndex
  }
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}

interface BlockProps {
  block: LegalBlock
  date: string
}

function Block({ block, date }: BlockProps) {
  const f = (t: string) => fillLegal(t, date)
  if (typeof block === 'string')
    return (
      <p>
        <Inline text={f(block)} />
      </p>
    )
  if ('ul' in block)
    return (
      <ul className="list-disc space-y-1.5 pl-5">
        {block.ul.map((item) => (
          <li key={item}>
            <Inline text={f(item)} />
          </li>
        ))}
      </ul>
    )
  if ('ol' in block)
    return (
      <ol className="list-decimal space-y-1.5 pl-5">
        {block.ol.map((item) => (
          <li key={item}>
            <Inline text={f(item)} />
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
            {block.table.head.map((h) => (
              <th key={h} scope="col" className="px-3 py-2.5 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.table.rows.map((row) => (
            <tr key={row.join('|')} className="border-t border-line align-top">
              {row.map((cell, i) => (
                <td
                  key={i}
                  className={
                    i === 0
                      ? 'px-3 py-2.5 font-medium'
                      : 'px-3 py-2.5 text-ink-soft'
                  }
                >
                  <Inline text={f(cell)} />
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
  const t = useMessages(commonMessages).legal
  const doc: LegalDoc = legalDocs[id][locale]
  const date = formatDate(locale, doc.updated ?? legal.effectiveDate, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const others = (Object.keys(legalPaths) as Array<LegalDocId>).filter(
    (d) => d !== id,
  )

  return (
    <article className="mx-auto max-w-3xl px-4 pt-12 pb-20 sm:px-6">
      <header className="border-b border-line pb-6">
        <h1 className="type-display text-[clamp(2.5rem,6vw,3.75rem)]">
          {doc.title}
        </h1>
        <p className="mt-3 text-ink-soft">{fillLegal(doc.summary, date)}</p>
        <p className="mt-2 text-sm text-ink-soft">
          {doc.updated
            ? fmt(t.reviewed, { date })
            : fmt(t.updated, { date, version: legal.version })}
        </p>
      </header>

      <nav
        aria-labelledby="legal-toc"
        className="mt-6 rounded-xl border border-line bg-surface p-4"
      >
        <h2 id="legal-toc" className="text-sm font-semibold">
          {t.contents}
        </h2>
        <ol className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
          {doc.sections.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="text-ink-soft underline-offset-4 hover:text-ink hover:underline"
              >
                {s.heading}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-10 space-y-10 leading-relaxed">
        {doc.sections.map((section) => (
          <section
            key={section.id}
            id={section.id}
            aria-labelledby={`${section.id}-h`}
            className="scroll-mt-24 space-y-3"
          >
            <h2 id={`${section.id}-h`} className="type-heading text-2xl">
              {section.heading}
            </h2>
            {section.blocks.map((block, i) => (
              <Fragment key={i}>
                <Block block={block} date={date} />
              </Fragment>
            ))}
          </section>
        ))}
      </div>

      <footer className="mt-14 border-t border-line pt-6">
        <h2 className="text-sm font-semibold">{t.otherDocs}</h2>
        <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
          {others.map((d) => (
            <li key={d}>
              <Link
                to={legalPaths[d]}
                className="font-medium underline underline-offset-4"
              >
                {legalDocs[d][locale].title}
              </Link>
            </li>
          ))}
        </ul>
      </footer>
    </article>
  )
}
