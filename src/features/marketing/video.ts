import type { Locale } from '#/i18n/config'

/**
 * Pliki filmu promocyjnego per język. Generuje je marketing/video/render.py (out/promo-{lang}-*),
 * kopie dla strony leżą w public/media jako timeblame-{lang}-*. Nowa nazwa pliku przy każdej
 * zmianie filmu: /media ma cache na 30 dni. Teksty (tytuł, opis, transkrypcja) są w słowniku marketing.
 */
export function promoVideoFiles(locale: Locale) {
  const base = `/media/timeblame-${locale}`
  return {
    src: `${base}-web.mp4`,
    /** Napisy z tekstu lektora (voiceover.py → promo-{lang}.vtt). */
    captions: `${base}.vtt`,
    poster: {
      avif: `${base}-poster-1280.avif`,
      avifMedium: `${base}-poster-800.avif`,
      avifSmall: `${base}-poster-640.avif`,
      webp: `${base}-poster-1280.webp`,
      webpMedium: `${base}-poster-800.webp`,
      webpSmall: `${base}-poster-640.webp`,
      width: 1280,
      height: 720,
    },
  }
}

export const promoVideoMeta = {
  durationIso: 'PT28S',
  uploadDate: '2026-11-27',
  /** true, gdy w public/media leży wersja z lektorem — wtedy film startuje z dźwiękiem. */
  hasVoice: false,
} as const
