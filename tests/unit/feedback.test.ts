import { describe, expect, it } from 'vitest'
import {
  browserLabel,
  feedbackMessageError,
  feedbackPage,
  isOpenFeedback,
} from '#/features/feedback/domain/feedback'

describe('feedback rules', () => {
  it.each<[string, string]>([
    ['/app/tasks?token=abc', '/app/tasks'],
    ['/reset-password#token', '/reset-password'],
    ['', '/'],
  ])('Should keep only the path of %s', (path, expected) => {
    expect(feedbackPage(path)).toBe(expected)
  })

  it.each<[string, ReturnType<typeof feedbackMessageError>]>([
    ['  hi  ', 'tooShort'],
    ['It breaks when I pause', null],
    ['x'.repeat(4001), 'tooLong'],
  ])('Should check the length of "%s"', (message, expected) => {
    expect(feedbackMessageError(message)).toBe(expected)
  })

  it.each<[string, string]>([
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Chrome 131, Windows',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/131.0 Safari/537.36 Edg/131.0',
      'Edge 131, Windows',
    ],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5; rv:133.0) Gecko/20100101 Firefox/133.0',
      'Firefox 133, macOS',
    ],
  ])('Should describe the browser %#', (userAgent, expected) => {
    expect(browserLabel(userAgent)).toBe(expected)
  })

  it.each<[Parameters<typeof isOpenFeedback>[0], boolean]>([
    ['new', true],
    ['in_progress', true],
    ['done', false],
    ['dismissed', false],
  ])('Should treat %s as open: %s', (status, open) => {
    expect(isOpenFeedback(status)).toBe(open)
  })
})
