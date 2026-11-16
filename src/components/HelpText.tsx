import type { ReactNode } from 'react'

// A lead word or short phrase ending in ":" at the start of a line ("Quando:", "Ligado:", "Ex.:") shows in bold.
const LEAD = /^[^:\n]{1,30}:/

// Help text of a field tip: one paragraph per line, the lead of each line in bold.
export function helpText(lines: readonly string[]): ReactNode {
  return lines.map((line) => {
    const lead = LEAD.exec(line)?.[0]
    return (
      <span key={line} className="hint-line">
        {lead ? <><strong>{lead}</strong>{line.slice(lead.length)}</> : line}
      </span>
    )
  })
}
