import { useState } from 'react'

// Copies a text and says so for two seconds. Without clipboard access the text next to it stays selectable.
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button className="ghost-button" type="button" aria-label={label} onClick={() => void copy()}>
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  )
}
