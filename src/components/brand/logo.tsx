import { cn } from '#/lib/utils'
import { site } from '#/config/site'

const C = 69.115 // obwód okręgu r=11

/**
 * Znak Splits: stoper, którego tarcza to międzyczasy w kolorach rodzajów pracy.
 * Ten sam znak jest w filmie, obrazie OG i ikonach (marketing/brand).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden
      className={cn('size-7 shrink-0', className)}
    >
      <rect
        x="13"
        y="1.5"
        width="6"
        height="3.2"
        rx="1.3"
        fill="currentColor"
      />
      <rect x="15" y="3.8" width="2" height="3.6" fill="currentColor" />
      <g transform="rotate(-90 16 18)" fill="none" strokeWidth="4.2">
        <circle
          cx="16"
          cy="18"
          r="11"
          stroke="var(--wt-task)"
          strokeDasharray={`25.33 ${C}`}
          strokeDashoffset="-1.1"
        />
        <circle
          cx="16"
          cy="18"
          r="11"
          stroke="var(--wt-review)"
          strokeDasharray={`9.65 ${C}`}
          strokeDashoffset="-28.63"
        />
        <circle
          cx="16"
          cy="18"
          r="11"
          stroke="var(--wt-pair)"
          strokeDasharray={`15.68 ${C}`}
          strokeDashoffset="-40.48"
        />
        <circle
          cx="16"
          cy="18"
          r="11"
          stroke="var(--wt-extra)"
          strokeDasharray={`9.65 ${C}`}
          strokeDashoffset="-58.36"
        />
      </g>
      <path
        d="M16 18 L19.9 13.4"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="16" cy="18" r="1.9" fill="currentColor" />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label={site.name}
      className={cn('inline-flex items-center gap-2 text-ink', className)}
    >
      <LogoMark />
      <span
        aria-hidden
        className="font-display text-[1.375rem] leading-none font-[780] tracking-[-0.03em]"
      >
        splits
      </span>
    </span>
  )
}
