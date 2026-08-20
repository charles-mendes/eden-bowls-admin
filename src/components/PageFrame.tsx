import { type ReactNode } from 'react'

export function PageFrame({
  title,
  description,
  actions,
  children,
}: {
  title: string
  description: string
  actions?: ReactNode
  children?: ReactNode
}) {
  return (
    <section className="page-frame">
      <div className="page-heading">
        <div>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
        </div>
        {actions || null}
      </div>
      {children}
    </section>
  )
}
