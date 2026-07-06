import { type ReactNode } from 'react'

export function FiltersBar({ children }: { children: ReactNode }) {
  return <div className="filters-bar">{children}</div>
}