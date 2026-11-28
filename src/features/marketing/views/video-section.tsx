import { useState } from 'react'
import { Play } from 'lucide-react'
import { useI18n, useMessages } from '#/i18n/context'
import { marketingMessages } from '#/i18n/messages/marketing'
import { track } from '#/integrations/posthog/analytics'
import { promoVideoFiles, promoVideoMeta } from '../domain/video'

/**
 * Odtwarzacz z "fasadą": do kliknięcia strona ładuje tylko lekki poster (AVIF/WebP, lazy),
 * a plik MP4 pobiera się dopiero, gdy ktoś chce obejrzeć film. Zero wpływu na wynik Lighthouse.
 */
export function VideoSection() {
  const [playing, setPlaying] = useState(false)
  const { locale } = useI18n()
  const messages = useMessages(marketingMessages).video
  const { src: videoSource, poster, captions } = promoVideoFiles(locale)
  const sizes = '(min-width: 1152px) 1104px, 100vw'

  return (
    <div className="space-y-4">
      <div className="relative aspect-video overflow-hidden rounded-2xl border border-line bg-[var(--ink-fixed)] shadow-[0_24px_60px_-28px_rgba(20,22,43,0.35)]">
        {playing ? (
          <video
            className="size-full"
            src={videoSource}
            poster={poster.webp}
            controls
            autoPlay
            playsInline
            muted={!promoVideoMeta.hasVoice}
            onEnded={() => track('promo_video_completed', { locale })}
            aria-label={messages.name}
            aria-describedby="video-transcript"
          >
            <track
              kind="captions"
              src={captions}
              srcLang={locale}
              label={messages.captionsLabel}
              default
            />
          </video>
        ) : (
          <button
            type="button"
            onClick={() => {
              setPlaying(true)
              track('promo_video_played', { locale })
            }}
            className="group relative block size-full cursor-pointer"
          >
            <picture>
              <source
                type="image/avif"
                srcSet={`${poster.avifSmall} 640w, ${poster.avifMedium} 800w, ${poster.avif} 1280w`}
                sizes={sizes}
              />
              <img
                src={poster.webp}
                srcSet={`${poster.webpSmall} 640w, ${poster.webpMedium} 800w, ${poster.webp} 1280w`}
                sizes={sizes}
                width={poster.width}
                height={poster.height}
                loading="lazy"
                decoding="async"
                alt=""
                className="size-full object-cover"
              />
            </picture>
            <span className="absolute bottom-3 left-3 inline-flex items-center gap-2.5 rounded-full bg-[var(--ink-fixed)] py-1.5 pr-4 pl-1.5 text-sm font-medium text-white shadow-lg sm:bottom-7 sm:left-7 sm:gap-3 sm:py-2 sm:pr-5 sm:pl-2 sm:text-base">
              <span className="grid size-8 place-items-center rounded-full bg-white text-[var(--ink-fixed)] transition-transform group-hover:scale-105 sm:size-10">
                <Play
                  aria-hidden
                  className="size-4 translate-x-px"
                  fill="currentColor"
                />
              </span>
              {messages.play}
              <span className="sr-only">{messages.playSuffix}</span>
            </span>
          </button>
        )}
      </div>
      <details className="text-sm text-ink-soft">
        <summary className="w-fit cursor-pointer rounded-md font-medium text-ink">
          {messages.transcriptToggle}
        </summary>
        <ul
          id="video-transcript"
          className="mt-3 max-w-[68ch] list-disc space-y-1.5 pl-5"
        >
          {messages.transcript.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>
    </div>
  )
}
