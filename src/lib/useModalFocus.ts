import { useEffect, useEffectEvent, type RefObject } from 'react'

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]'

function focusables(panel: HTMLElement) {
  return [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => (
    !element.hasAttribute('disabled') && element.tabIndex !== -1 && element.getAttribute('aria-hidden') !== 'true'
  ))
}

// Focus handling of a modal panel: focuses the first match of focusSelector when it opens, closes on Escape
// and gives the focus back on close. With trapTab, Tab and Shift+Tab cycle inside the panel.
export function useModalFocus(
  open: boolean,
  panelRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  { focusSelector, trapTab = false }: { focusSelector: string; trapTab?: boolean },
) {
  const close = useEffectEvent(onClose)

  useEffect(() => {
    if (!open) return undefined

    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const panel = panelRef.current
    panel?.querySelector<HTMLElement>(focusSelector)?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
        return
      }
      if (!trapTab || event.key !== 'Tab' || !panel) return
      const items = focusables(panel)
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      const outside = !(active instanceof Node) || !panel.contains(active)
      if (event.shiftKey && (outside || active === first)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (outside || active === last)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previous?.focus()
    }
  }, [open, panelRef, focusSelector, trapTab])
}
