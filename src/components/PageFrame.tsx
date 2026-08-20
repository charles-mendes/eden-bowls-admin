import { type ReactNode } from 'react'

export function PageFrame({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children?: ReactNode
}) {
  return (
    <section className="page-frame">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Portal</p>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
        </div>
      </div>
      {children}
    </section>
  )
}
