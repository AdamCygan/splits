import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useMessages } from '#/i18n/context'
import { feedbackMessages } from '#/i18n/messages/feedback'
import { useDataMutation } from '#/shared/data/mutations'
import { feedbackApi } from '../data/api'
import { feedbackKeys, myFeedbackQuery } from '../data/queries'
import {
  browserLabel,
  feedbackMessageError,
  feedbackPage,
  feedbackUserAgent,
} from '../domain/feedback'
import type { FeedbackKind } from '../domain/feedback'

export interface FeedbackFormOptions {
  initialKind: FeedbackKind
  onSent: () => void
}

/** Okno zgłoszenia: rodzaj, treść, zgoda na dołączenie strony i przeglądarki, wysyłka. */
export function useFeedbackForm({ initialKind, onSent }: FeedbackFormOptions) {
  const messages = useMessages(feedbackMessages).dialog
  const [kind, setKind] = useState<FeedbackKind>(initialKind)
  const [message, setMessage] = useState('')
  const [withContext, setWithContext] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const page = feedbackPage(window.location.pathname)
  const userAgent = feedbackUserAgent(navigator.userAgent)
  const error = feedbackMessageError(message)

  const send = useDataMutation(feedbackApi.send, {
    invalidate: [feedbackKeys.mine],
    success: messages.sent,
    onSuccess: onSent,
  })

  const submit = () => {
    setSubmitted(true)
    if (error) return
    send.mutate({
      kind,
      message: message.trim(),
      page: withContext ? page : null,
      userAgent: withContext ? userAgent : null,
    })
  }

  return {
    kind,
    setKind,
    message,
    setMessage,
    withContext,
    setWithContext,
    page,
    browser: browserLabel(userAgent),
    error: submitted && error ? messages[error] : null,
    sending: send.isPending,
    submit,
  }
}

/** Moje zgłoszenia (strona Pomoc). */
export function useMyFeedback() {
  return useQuery(myFeedbackQuery)
}
