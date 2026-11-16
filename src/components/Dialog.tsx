import { type ReactNode, useId, useRef } from 'react'
import { useModalFocus } from '../lib/useModalFocus'

type DialogProps = {
  title: string
  description?: string
  open: boolean
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  // Wide panel, for long texts such as a legal document.
  wide?: boolean
}

export function Dialog({ title, description, open, onClose, children, footer, wide = false }: DialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  useModalFocus(open, panelRef, onClose, {
    focusSelector: '.dialog-body input, .dialog-body select, .dialog-body textarea, .dialog-body button',
  })

  if (!open) return null

  return (
    <div className="dialog-overlay" onMouseDown={onClose}>
      <div
        ref={panelRef}
        className={wide ? 'dialog-panel dialog-panel-wide' : 'dialog-panel'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="dialog-header">
          <div>
            <h3 id={titleId}>{title}</h3>
            {description ? <p id={descriptionId} className="muted">{description}</p> : null}
          </div>
          <button type="button" className="ghost-button" onClick={onClose}>
            Fechar
          </button>
        </header>
        <div className="dialog-body">{children}</div>
        {footer ? <footer className="dialog-footer">{footer}</footer> : null}
      </div>
    </div>
  )
}
