/** Przeglądarka i system z nagłówka User-Agent, do listy zalogowanych urządzeń. */
export function describeDevice(
  userAgent: string | null,
): { browser: string; operatingSystem: string } | null {
  if (!userAgent) return null
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /OPR\/|Opera/.test(userAgent)
      ? 'Opera'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Chrome\/|CriOS\//.test(userAgent)
          ? 'Chrome'
          : /Safari\//.test(userAgent)
            ? 'Safari'
            : null
  const operatingSystem = /iPhone|iPad|iPod/.test(userAgent)
    ? 'iOS'
    : /Android/.test(userAgent)
      ? 'Android'
      : /Windows/.test(userAgent)
        ? 'Windows'
        : /Mac OS X|Macintosh/.test(userAgent)
          ? 'macOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : null
  const isUnknown = !browser && !operatingSystem
  if (isUnknown) return null
  return { browser: browser ?? '?', operatingSystem: operatingSystem ?? '?' }
}
