import { type ReactNode, useId, useRef } from 'react'
import { useModalFocus } from '../lib/useModalFocus'

type DrawerProps = {
  title: string
  description?: string
  open: boolean
  // Called by the close button, Escape and a click outside; the owner decides whether to close.
  onRequestClose: () => void
  // Fixed under the title, above the scrolling body.
  notice?: ReactNode
  children: ReactNode
}

// Wide side panel over the page, for forms too long for a Dialog. Focus starts on the close button and
// Tab stays inside the panel while it is open.
export function Drawer({ title, description, open, onRequestClose, notice, children }: DrawerProps) {
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef<HTMLElement>(null)
  useModalFocus(open, panelRef, onRequestClose, { focusSelector: '.drawer-close', trapTab: true })

  if (!open) return null

  return (
    <div className="drawer-overlay" onMouseDown={onRequestClose}>
      <aside
        ref={panelRef}
        className="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="drawer-header">
          <div className="drawer-heading">
            <div>
              <h3 id={titleId}>{title}</h3>
              {description ? <p id={descriptionId} className="muted">{description}</p> : null}
            </div>
            <button type="button" className="ghost-button drawer-close" onClick={onRequestClose}>
              Fechar
            </button>
          </div>
          {notice}
        </header>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  )
}
