import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'

// `hint` is a short line under the label, read as the item's description. `separated` draws a line above the item.
type RowMenuItemBase = { label: string; hint?: string; separated?: boolean }

export type RowMenuItem =
  | (RowMenuItemBase & { to: string })
  | (RowMenuItemBase & { onSelect: () => void; danger?: boolean })
  | (RowMenuItemBase & { disabled: true })

// A "⋯" menu for a table row. The list is fixed-positioned so the table's scroll box does not clip it.
export function RowMenu({ label, items }: { label: string; items: RowMenuItem[] }) {
  const [position, setPosition] = useState<CSSProperties | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const menuId = useId()
  const open = position !== null

  const close = (refocus = false) => {
    setPosition(null)
    if (refocus) buttonRef.current?.focus()
  }

  const toggle = () => {
    if (open) {
      close()
      return
    }
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    // Opens upward when the rows below the button leave no room for the list.
    const height = items.reduce((sum, item) => sum + (item.hint ? 52 : 36) + (item.separated ? 9 : 0), 10)
    const below = rect.bottom + 4 + height <= window.innerHeight
    setPosition({
      top: below ? rect.bottom + 4 : Math.max(8, rect.top - 4 - height),
      right: Math.max(8, window.innerWidth - rect.right),
    })
  }

  useEffect(() => {
    if (!open) return undefined
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')?.focus()

    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) close()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close(true)
        return
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
      event.preventDefault()
      const entries = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? [])
      const index = entries.indexOf(document.activeElement as HTMLElement)
      const next = entries[(index + (event.key === 'ArrowDown' ? 1 : entries.length - 1)) % entries.length]
      next?.focus()
    }
    const onScroll = () => close()

    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onScroll)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onScroll)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="row-menu-button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={toggle}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {open ? (
        <ul ref={menuRef} id={menuId} className="row-menu" role="menu" aria-label={label} style={position}>
          {items.map((item, index) => {
            const hintId = item.hint ? `${menuId}-hint-${index}` : undefined
            const content = item.hint ? (
              <>
                <span className="row-menu-label">{item.label}</span>
                <span id={hintId} className="row-menu-hint">{item.hint}</span>
              </>
            ) : item.label
            return [
              item.separated && index > 0 ? <li key={`${item.label}-separator`} role="separator" className="row-menu-separator" /> : null,
              <li key={item.label} role="none">
                {'to' in item ? (
                  <Link role="menuitem" to={item.to} aria-label={item.hint ? item.label : undefined} aria-describedby={hintId} onClick={() => close()}>{content}</Link>
                ) : 'onSelect' in item ? (
                  <button
                    type="button"
                    role="menuitem"
                    aria-label={item.hint ? item.label : undefined}
                    aria-describedby={hintId}
                    className={item.danger ? 'row-menu-danger' : undefined}
                    onClick={() => { close(); item.onSelect() }}
                  >
                    {content}
                  </button>
                ) : (
                  <span role="menuitem" aria-disabled="true" aria-label={item.hint ? item.label : undefined} aria-describedby={hintId}>{content}</span>
                )}
              </li>,
            ]
          })}
        </ul>
      ) : null}
    </>
  )
}
