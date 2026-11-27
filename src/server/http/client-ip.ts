import { isIP } from 'node:net'

interface HeaderSource {
  header: (name: string) => string | undefined
}

/**
 * Adres IP klienta z jednego zaufanego nagłówka proxy (CLIENT_IP_HEADER).
 * Przy liście adresów (X-Forwarded-For) bierzemy pierwszy. Wartość, która nie jest adresem IP,
 * jest odrzucana, żeby nie trafiała do kluczy limitów ani do listy sesji.
 */
export function clientIp(request: HeaderSource, headerName: string) {
  const raw = request.header(headerName)?.split(',')[0]?.trim()
  return raw && isIP(raw) ? raw : null
}
