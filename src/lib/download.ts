/** Zapisuje treść jako plik u użytkownika (link `download` z adresem blob). */
export function downloadFile(
  name: string,
  parts: Array<BlobPart>,
  type: string,
) {
  const url = URL.createObjectURL(new Blob(parts, { type }))
  const element = document.createElement('a')
  element.href = url
  element.download = name
  element.click()
  URL.revokeObjectURL(url)
}
