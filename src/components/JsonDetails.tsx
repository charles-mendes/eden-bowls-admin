import { useState } from 'react'
import { formatJson } from '../lib/format'

export function JsonDetails({ title, value }: { title: string; value: unknown }) {
  const [open, setOpen] = useState(false)
  if (value == null) return null

  return (
    <details
      className="json-details"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>{title}</summary>
      {open ? <pre>{formatJson(value)}</pre> : null}
    </details>
  )
}
