import { type ReactNode } from 'react'

export function Section({
  title,
  description,
  actions,
  children,
}: {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="section-card">
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