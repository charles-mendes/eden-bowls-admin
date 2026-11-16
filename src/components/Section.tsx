import { type ReactNode } from 'react'

export function Section({
  id,
  title,
  description,
  actions,
  hint,
  children,
}: {
  id?: string
  title: string
  description?: string
  actions?: ReactNode
  // An InfoHint (or similar) shown right after the title.
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <section id={id} className="section-card">
      <div className="section-head">
        <div>
          {hint ? <div className="section-title-row"><h3>{title}</h3>{hint}</div> : <h3>{title}</h3>}
          {description ? <p className="muted">{description}</p> : null}
        </div>
        {actions || null}
      </div>
      {children}
    </section>
  )
}