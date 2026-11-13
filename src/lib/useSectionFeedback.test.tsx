import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SectionFeedbackView } from '../components/SectionFeedbackView'
import { FEEDBACK_SUCCESS_MS, useSectionFeedback, type SectionFeedback } from './useSectionFeedback'

let feedback: SectionFeedback

function expose(value: SectionFeedback) {
  feedback = value
}

function Harness() {
  const value = useSectionFeedback()
  expose(value)
  return <SectionFeedbackView feedback={value} />
}

describe('useSectionFeedback', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('a success clears on its own', () => {
    vi.useFakeTimers()
    render(<Harness />)

    act(() => feedback.succeed('Invoice enviada.'))
    expect(screen.getByRole('status')).toHaveTextContent('Invoice enviada.')

    act(() => { vi.advanceTimersByTime(FEEDBACK_SUCCESS_MS) })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('an error stays after the timer and closes with its button', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<Harness />)

    act(() => feedback.fail('Falha ao enviar invoice'))
    act(() => { vi.advanceTimersByTime(FEEDBACK_SUCCESS_MS * 3) })
    expect(screen.getByRole('alert')).toHaveTextContent('Falha ao enviar invoice')

    await user.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('the next action of the section clears the error', () => {
    render(<Harness />)

    act(() => feedback.fail('Falha'))
    act(() => feedback.start())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
