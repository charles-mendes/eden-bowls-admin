import { useState } from 'react'
import { maskDigits } from '../lib/brDate'
import { from12Hour, to12Hour, type DayPeriod } from '../lib/deliveryCalendar'

type UsTimeInputProps = {
  // 24-hour HH:MM, as the API stores it; '' while the typed time is incomplete.
  value: string
  onChange: (value: string) => void
  // Accessible name of the time; the AM/PM choice is named after it.
  label: string
  describedBy?: string
  disabled?: boolean
  className?: string
}

// A time of day typed in 12 hours (hh:mm, 01–12) with AM or PM, for the United States. It speaks 24-hour HH:MM to
// the page, so the API and the rules do not change.
export function UsTimeInput({ value, onChange, label, describedBy, disabled = false, className }: UsTimeInputProps) {
  const initial = value ? to12Hour(value) : { time: '', period: 'AM' as DayPeriod }
  const [text, setText] = useState(initial.time)
  const [period, setPeriod] = useState<DayPeriod>(initial.period)
  const [seen, setSeen] = useState(value)

  // A value set from outside (undo, copy hours) replaces what is shown; the operator's own typing does not loop back.
  if (value !== seen) {
    setSeen(value)
    if (value && from12Hour(text, period) !== value) {
      const next = to12Hour(value)
      setText(next.time)
      setPeriod(next.period)
    }
  }

  const emit = (nextText: string, nextPeriod: DayPeriod) => {
    const time = from12Hour(nextText, nextPeriod)
    if (time !== value) {
      setSeen(time)
      onChange(time)
    }
  }

  return (
    <span className="us-time">
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="hh:mm"
        maxLength={5}
        className={className}
        aria-label={label}
        aria-describedby={describedBy}
        disabled={disabled}
        value={text}
        onChange={(event) => {
          const next = maskDigits(event.target.value, [2, 2], ':')
          setText(next)
          emit(next, period)
        }}
      />
      <span className="us-time-period" role="radiogroup" aria-label={`${label}, AM ou PM`}>
        {(['AM', 'PM'] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={period === option}
            className={period === option ? 'us-time-option active' : 'us-time-option'}
            disabled={disabled}
            onClick={() => {
              setPeriod(option)
              emit(text, option)
            }}
          >
            {option}
          </button>
        ))}
      </span>
    </span>
  )
}
