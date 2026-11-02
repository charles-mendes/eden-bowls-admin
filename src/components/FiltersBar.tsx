import { type ReactNode } from 'react'

export function FiltersBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className ? `filters-bar ${className}` : 'filters-bar'}>{children}</div>
}