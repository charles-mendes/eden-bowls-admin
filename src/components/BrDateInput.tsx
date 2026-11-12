import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type InputHTMLAttributes, type KeyboardEvent, type RefObject } from 'react'
import {
  MONTH_NAMES,
  WEEKDAY_NAMES,
  WEEKDAY_SHORT,
  brDateToIso,
  isoToBrDate,
  localToday,
  longBrDate,
  maskDigits,
  monthWeeks,
  shiftDay,
  validTime,
} from '../lib/brDate'

// The browser draws `type="date"`, `type="time"` and `datetime-local` in the language of the operator's system,
// not of the page, so an English Chrome shows mm/dd/yyyy and AM/PM. These fields are typed text in the Brazilian
// format and hand back the ISO value the native inputs would.

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'defaultValue'> & {
  value: string
  onChange: (value: string) => void
}

// A day typed as dd/mm/aaaa. `value` and `onChange` speak ISO (yyyy-mm-dd), '' while the day is incomplete.
export function BrDateInput({ value, onChange, ...rest }: FieldProps) {
  const [text, setText] = useState(() => isoToBrDate(value))
  const [seen, setSeen] = useState(value)

  // A value set from outside (a preset, the URL) replaces what is typed; the operator's own typing does not loop back.
  if (value !== seen) {
    setSeen(value)
    if (brDateToIso(text) !== value) setText(isoToBrDate(value))
  }

  const [open, setOpen] = useState(false)
  const wrapper = useRef<HTMLSpanElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)

  // A click outside or Escape closes the calendar.
  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  // Closing from inside the calendar gives the focus back to its button.
  const close = () => {
    setOpen(false)
    toggle.current?.focus()
  }

  const pick = (iso: string) => {
    setText(isoToBrDate(iso))
    close()
    if (iso !== value) onChange(iso)
  }

  return (
    <span className="br-date" ref={wrapper}>
      <input
        {...rest}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/aaaa"
        maxLength={10}
        value={text}
        onChange={(event) => {
          const next = maskDigits(event.target.value, [2, 2, 4], '/')
          setText(next)
          const iso = brDateToIso(next)
          if (iso !== value) onChange(iso)
        }}
      />
      <button
        ref={toggle}
        type="button"
        className="br-date-toggle"
        aria-label="Abrir calendário"
        aria-expanded={open}
        disabled={rest.disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      </button>
      {open ? <CalendarPopover anchor={wrapper} selected={value} onPick={pick} onClose={close} /> : null}
    </span>
  )
}

// A month in Portuguese, Sunday first. Arrows move the day, PageUp/PageDown the month, Enter picks, Escape closes.
function CalendarPopover({ anchor, selected, onPick, onClose }: {
  anchor: RefObject<HTMLSpanElement | null>
  selected: string
  onPick: (iso: string) => void
  onClose: () => void
}) {
  const today = localToday()
  const [focused, setFocused] = useState(selected || today)
  const [year, month] = focused.split('-').map(Number)
  const grid = useRef<HTMLTableElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState<CSSProperties>({ top: 0, left: 0, opacity: 0 })

  // Fixed to the field, so a dialog that scrolls does not cut it; above the field when there is no room below.
  useLayoutEffect(() => {
    const placeIt = () => {
      const field = anchor.current?.getBoundingClientRect()
      const height = panel.current?.offsetHeight ?? 0
      const width = panel.current?.offsetWidth ?? 0
      if (!field) return
      const below = field.bottom + 4
      const top = below + height > window.innerHeight - 8 && field.top - height - 4 >= 8 ? field.top - height - 4 : below
      const left = Math.max(8, Math.min(field.left, window.innerWidth - width - 8))
      setPlace({ top, left })
    }
    placeIt()
    window.addEventListener('resize', placeIt)
    window.addEventListener('scroll', placeIt, true)
    return () => {
      window.removeEventListener('resize', placeIt)
      window.removeEventListener('scroll', placeIt, true)
    }
  }, [anchor])

  useEffect(() => {
    // The focused day holds the keyboard focus, from the moment the calendar opens.
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${focused}"]`)?.focus({ preventScroll: true })
  }, [focused])

  const monthName = MONTH_NAMES[month - 1]
  const monthTitle = `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} de ${year}`

  const goMonth = (delta: number) => {
    const target = new Date(Date.UTC(year, month - 1 + delta, 1))
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
    const day = Math.min(Number(focused.slice(8, 10)), lastDay)
    setFocused(`${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onClose()
    } else if (event.key in step && (event.target as HTMLElement).dataset.day) {
      event.preventDefault()
      setFocused(shiftDay(focused, step[event.key]))
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault()
      goMonth(event.key === 'PageUp' ? -1 : 1)
    }
  }

  return (
    <div ref={panel} className="br-calendar" style={place} role="dialog" aria-label="Calendário" onKeyDown={onKeyDown}>
      <div className="br-calendar-head">
        <button type="button" className="br-calendar-nav" aria-label="Mês anterior" onClick={() => goMonth(-1)}>‹</button>
        <span aria-live="polite">{monthTitle}</span>
        <button type="button" className="br-calendar-nav" aria-label="Próximo mês" onClick={() => goMonth(1)}>›</button>
      </div>
      <table ref={grid} role="grid" aria-label={`${MONTH_NAMES[month - 1]} de ${year}`}>
        <thead>
          <tr>
            {WEEKDAY_SHORT.map((short, index) => <th key={index} scope="col" abbr={WEEKDAY_NAMES[index]}>{short}</th>)}
          </tr>
        </thead>
        <tbody>
          {monthWeeks(year, month).map((week, row) => (
            <tr key={row}>
              {week.map((day, column) => (
                <td key={column}>
                  {day ? (
                    <button
                      type="button"
                      data-day={day}
                      tabIndex={day === focused ? 0 : -1}
                      aria-label={longBrDate(day)}
                      aria-pressed={day === selected}
                      aria-current={day === today ? 'date' : undefined}
                      className={['br-calendar-day', day === selected ? 'selected' : '', day === today ? 'today' : ''].filter(Boolean).join(' ')}
                      onClick={() => onPick(day)}
                    >
                      {Number(day.slice(8, 10))}
                    </button>
                  ) : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="br-calendar-foot">
        <button type="button" className="link-button" onClick={() => onPick(today)}>Hoje</button>
      </div>
    </div>
  )
}

// A time of day typed as hh:mm, 24 hours. `onChange` gets '' while it is incomplete.
export function BrTimeInput({ value, onChange, ...rest }: FieldProps) {
  const [text, setText] = useState(value)
  const [seen, setSeen] = useState(value)

  if (value !== seen) {
    setSeen(value)
    if (validTime(text) !== value) setText(value)
  }

  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="hh:mm"
      maxLength={5}
      value={text}
      onChange={(event) => {
        const next = maskDigits(event.target.value, [2, 2], ':')
        setText(next)
        const time = validTime(next)
        if (time !== value) onChange(time)
      }}
    />
  )
}
