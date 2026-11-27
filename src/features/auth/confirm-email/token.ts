/**
 * Token z linku w e-mailu (jak przy resecie hasła). Osobny moduł bez zależności: używa go
 * validateSearch trasy, a definicje tras trafiają do głównego bundla (także strony głównej).
 */
export const isEmailToken = (token: unknown): token is string =>
  typeof token === 'string' && /^[\w-]{10,200}$/.test(token)
