import { type ReactNode } from 'react'

export function Section({
  id,
  title,
  description,
  actions,
  children,
}: {
  id?: string
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section id={id} className="section-card">
      <div className="section-head">
        <div>
          <h3>{title}</h3>
          {description ? <p className="muted">{description}</p> : null}
        </div>
        {actions || null}
      </div>
      {children}
    </section>
  )
}