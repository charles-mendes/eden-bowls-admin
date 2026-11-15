import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

type InfoHintProps = {
  // The tip's element id: the field points aria-describedby here, so the text stays its description while closed.
  id: string
  // What the tip is about, for the button's accessible name.
  topic: string
  // Plain text, or formatted lines (still read as the field's description).
  text: ReactNode
  // A wider tip (up to 380px) than the field under it, for long explanations next to narrow fields.
  wide?: boolean
}

// An "i" next to a field label that shows its help text on tap or click. Escape or a tap outside closes it; Escape
// while it is open does not close the dialog around it.
export function InfoHint({ id, topic, text, wide = false }: InfoHintProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLSpanElement>(null)

  // A tip that would pass the right edge of the screen moves left, so it never adds a horizontal scroll.
  useLayoutEffect(() => {
    const tip = tipRef.current
    if (!open || !tip) return
    tip.style.transform = ''
    const box = tip.getBoundingClientRect()
    const overflow = box.right - (document.documentElement.clientWidth - 8)
    if (overflow > 0) tip.style.transform = `translateX(-${Math.min(overflow, Math.max(0, box.left - 8))}px)`
  }, [open])

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
      <span ref={tipRef} id={id} role="tooltip" className={wide ? 'info-hint-text info-hint-wide' : 'info-hint-text'} hidden={!open}>{text}</span>
    </span>
  )
}
