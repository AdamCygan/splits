import { useEffect, useState } from 'react'
import { useErrorText } from '#/lib/use-error-text'
import { confirmEmailOnce } from './model'
import type { ConfirmState } from './model'

/** ViewModel strony /confirm-email: potwierdza token raz i zwraca stan do wyświetlenia. */
export function useConfirmEmailViewModel(token: string | undefined) {
  const errorText = useErrorText()
  const [state, setState] = useState<ConfirmState>(
    token ? { status: 'checking' } : { status: 'missing' },
  )
  useEffect(() => {
    if (!token) return
    let active = true
    void confirmEmailOnce(token).then((next) => {
      if (active) setState(next)
    })
    return () => {
      active = false
    }
  }, [token])

  return {
    state,
    signedIn: 'signedIn' in state && state.signedIn,
    errorText: state.status === 'failed' ? errorText(state.error) : null,
  }
}

export type ConfirmEmailViewModel = ReturnType<typeof useConfirmEmailViewModel>
