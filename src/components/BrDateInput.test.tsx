import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrDateInput, BrTimeInput } from './BrDateInput'
import { brDateToIso, dateTextToIso, from12Hour, to12Hour, usTime, isoToBrDate, isoToDateText, localToday, monthWeeks, validTime } from '../lib/brDate'

function DateHarness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <label>Dia<BrDateInput value={value} onChange={setValue} /></label>
      <output>{value || 'vazio'}</output>
      <button type="button" onClick={() => setValue('2026-12-25')}>Natal</button>
    </>
  )
}

describe('BrTimeInput format us', () => {
  it('converts AM/PM to the 24-hour value the API keeps, with noon and midnight', () => {
    expect(to12Hour('14:05')).toEqual({ text: '02:05', period: 'PM' })
    expect(to12Hour('00:30')).toEqual({ text: '12:30', period: 'AM' })
    expect(to12Hour('12:00')).toEqual({ text: '12:00', period: 'PM' })
    expect(from12Hour('12:00', 'AM')).toBe('00:00')
    expect(from12Hour('12:00', 'PM')).toBe('12:00')
    expect(from12Hour('06:15', 'PM')).toBe('18:15')
    expect(from12Hour('13:00', 'PM')).toBe('')
    expect(from12Hour('00:10', 'AM')).toBe('')
    expect(usTime('18:00')).toBe('6:00 PM')
  })

  it('types hh:mm, picks AM/PM and hands back HH:MM', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [value, setValue] = useState('14:00')
      return (<><label>Ready<BrTimeInput format="us" value={value} onChange={setValue} /></label><output>{value || 'empty'}</output></>)
    }
    render(<Harness />)
    const field = screen.getByLabelText('Ready')
    expect(field).toHaveValue('02:00')
    expect(screen.getByLabelText('AM/PM')).toHaveValue('PM')
    await user.clear(field)
    await user.type(field, '0930')
    expect(screen.getByRole('status')).toHaveTextContent('21:30')
    await user.selectOptions(screen.getByLabelText('AM/PM'), 'AM')
    expect(screen.getByRole('status')).toHaveTextContent('09:30')
  })
})

describe('BrDateInput', () => {
  // purchase-error-monitor: the US format for US market pages.
  it('in the us format, types mm/dd/yyyy and draws the calendar in English', async () => {
    const user = userEvent.setup()
    expect(isoToDateText('2026-11-08', 'us')).toBe('11/08/2026')
    expect(dateTextToIso('11/08/2026', 'us')).toBe('2026-11-08')
    expect(dateTextToIso('13/08/2026', 'us')).toBe('')
    function UsHarness() {
      const [value, setValue] = useState('2026-11-08')
      return (<><label>Day<BrDateInput format="us" value={value} onChange={setValue} /></label><output>{value || 'empty'}</output></>)
    }
    render(<UsHarness />)
    const field = screen.getByLabelText('Day')
    expect(field).toHaveValue('11/08/2026')
    expect(field).toHaveAttribute('placeholder', 'mm/dd/yyyy')
    await user.clear(field)
    await user.type(field, '12252026')
    expect(field).toHaveValue('12/25/2026')
    expect(screen.getByRole('status')).toHaveTextContent('2026-12-25')
    await user.click(screen.getByRole('button', { name: 'Open calendar' }))
    expect(screen.getByRole('dialog', { name: 'Calendar' })).toHaveTextContent('December 2026')
    expect(screen.getByRole('button', { name: 'December 25, 2026' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('converts between dd/mm/aaaa and ISO, refusing impossible days', () => {
    expect(isoToBrDate('2026-11-08')).toBe('08/11/2026')
    expect(brDateToIso('08/11/2026')).toBe('2026-11-08')
    expect(brDateToIso('31/02/2026')).toBe('')
    expect(brDateToIso('08/11/20')).toBe('')
    expect(validTime('23:59')).toBe('23:59')
    expect(validTime('24:00')).toBe('')
  })

  it('shows the day as dd/mm/aaaa and hands back ISO once complete', async () => {
    const user = userEvent.setup()
    render(<DateHarness initial="2026-11-08" />)
    const input = screen.getByLabelText('Dia')
    expect(input).toHaveValue('08/11/2026')
    await user.clear(input)
    await user.type(input, '0503')
    expect(input).toHaveValue('05/03')
    expect(screen.getByRole('status')).toHaveTextContent('vazio')
    await user.type(input, '2026')
    expect(input).toHaveValue('05/03/2026')
    expect(screen.getByRole('status')).toHaveTextContent('2026-03-05')
    await user.click(screen.getByRole('button', { name: 'Natal' }))
    expect(input).toHaveValue('25/12/2026')
  })

  it('types a 24-hour time as hh:mm', async () => {
    const user = userEvent.setup()
    function TimeHarness() {
      const [value, setValue] = useState('')
      return <><label>Hora<BrTimeInput value={value} onChange={setValue} /></label><output>{value || 'vazio'}</output></>
    }
    render(<TimeHarness />)
    await user.type(screen.getByLabelText('Hora'), '1540')
    expect(screen.getByLabelText('Hora')).toHaveValue('15:40')
    expect(screen.getByRole('status')).toHaveTextContent('15:40')
  })

  it('lays out a month Sunday first', () => {
    const weeks = monthWeeks(2026, 11)
    expect(weeks[0][0]).toBe('2026-11-01')
    expect(weeks.at(-1)?.filter(Boolean).at(-1)).toBe('2026-11-30')
    expect(monthWeeks(2026, 2)[0].slice(0, 1)).toEqual(['2026-02-01'])
  })

  it('picks a day on the calendar, in Portuguese', async () => {
    const user = userEvent.setup()
    render(<DateHarness initial="2026-11-08" />)
    await user.click(screen.getByRole('button', { name: 'Abrir calendário' }))
    const calendar = screen.getByRole('dialog', { name: 'Calendário' })
    expect(calendar).toHaveTextContent('Novembro de 2026')
    expect(screen.getByRole('button', { name: '8 de novembro de 2026' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '8 de novembro de 2026' })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Próximo mês' }))
    expect(calendar).toHaveTextContent('Dezembro de 2026')
    await user.click(screen.getByRole('button', { name: '24 de dezembro de 2026' }))

    expect(screen.queryByRole('dialog', { name: 'Calendário' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Dia')).toHaveValue('24/12/2026')
    expect(screen.getByRole('status')).toHaveTextContent('2026-12-24')
    expect(screen.getByRole('button', { name: 'Abrir calendário' })).toHaveFocus()
  })

  it('moves with the arrows, picks with Enter and closes with Escape', async () => {
    const user = userEvent.setup()
    render(<DateHarness initial="2026-11-30" />)
    await user.click(screen.getByRole('button', { name: 'Abrir calendário' }))
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('button', { name: '1 de dezembro de 2026' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(screen.getByLabelText('Dia')).toHaveValue('01/12/2026')

    await user.click(screen.getByRole('button', { name: 'Abrir calendário' }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Calendário' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Dia')).toHaveValue('01/12/2026')
  })

  it('opens on today when empty and closes on a click outside', async () => {
    const user = userEvent.setup()
    render(<DateHarness />)
    await user.click(screen.getByRole('button', { name: 'Abrir calendário' }))
    const today = localToday()
    expect(screen.getByRole('dialog', { name: 'Calendário' }).querySelector(`[data-day="${today}"]`)).toHaveAttribute('aria-current', 'date')
    await user.click(screen.getByRole('status'))
    expect(screen.queryByRole('dialog', { name: 'Calendário' })).not.toBeInTheDocument()
  })
})
