import { type ReactNode } from 'react'

export function PageFrame({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow?: string
  title: string
  description: string
  actions?: ReactNode
  children?: ReactNode
}) {
  return (
    <section className="page-frame">
      <div className="page-heading">
        <div>
          {eyebrow ? <p className="page-eyebrow">{eyebrow}</p> : null}
          <h2>{title}</h2>
          <p className="muted">{description}</p>
        </div>
        {actions || null}
      </div>
      {children}
    </section>
  )
}
