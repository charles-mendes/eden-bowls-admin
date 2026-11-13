import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// The result of an action, shown in the section where it was taken. A success clears on its own; an error stays
// until the operator closes it or the next action of that section starts (`start`).
export type SectionFeedback = {
  message: string
  error: string
  start: () => void
  succeed: (text: string) => void
  fail: (text: string) => void
  dismiss: () => void
}

export const FEEDBACK_SUCCESS_MS = 6000

export function useSectionFeedback(successMs = FEEDBACK_SUCCESS_MS): SectionFeedback {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stopTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }, [])

  useEffect(() => stopTimer, [stopTimer])

  const start = useCallback(() => {
    stopTimer()
    setMessage('')
    setError('')
  }, [stopTimer])

  const succeed = useCallback((text: string) => {
    stopTimer()
    setError('')
    setMessage(text)
    if (text) timer.current = setTimeout(() => setMessage(''), successMs)
  }, [stopTimer, successMs])

  const fail = useCallback((text: string) => {
    stopTimer()
    setMessage('')
    setError(text)
  }, [stopTimer])

  const dismiss = useCallback(() => {
    stopTimer()
    setMessage('')
    setError('')
  }, [stopTimer])

  return useMemo(() => ({ message, error, start, succeed, fail, dismiss }), [message, error, start, succeed, fail, dismiss])
}
