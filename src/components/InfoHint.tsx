import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

type InfoHintProps = {
  // The tip's element id: the field points aria-describedby here, so the text stays its description while closed.
  id: string
  // What the tip is about, for the button's accessible name.
  topic: string
  text: string
}

// An "i" next to a field label that shows its help text on tap or click. Escape or a tap outside closes it; Escape
// while it is open does not close the dialog around it.
export function InfoHint({ id, topic, text }: InfoHintProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape' && open) {
      event.nativeEvent.stopPropagation()
      setOpen(false)
    }
  }

  return (
    <span ref={rootRef} className="info-hint">
      <button
        type="button"
        className="info-hint-button"
        aria-label={`Sobre ${topic}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={onKeyDown}
      >
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
          <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 7v4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8" cy="4.75" r="0.9" fill="currentColor" />
        </svg>
      </button>
      <span id={id} role="tooltip" className="info-hint-text" hidden={!open}>{text}</span>
    </span>
  )
}
