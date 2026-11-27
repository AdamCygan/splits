/** Zapisuje treść jako plik u użytkownika (link `download` z adresem blob). */
export function downloadFile(
  name: string,
  parts: Array<BlobPart>,
  type: string,
) {
  const url = URL.createObjectURL(new Blob(parts, { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
