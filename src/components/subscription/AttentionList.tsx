import { Link } from 'react-router-dom'
import type { AttentionEntry } from '../../lib/attention'

// The open problems of the subscription, each with its next step. Nothing open, nothing shown.
export function AttentionList({ entries }: { entries: AttentionEntry[] }) {
  if (!entries.length) return null
  return (
    <section className="section-card attention-list" aria-labelledby="attention-title">
      <div className="section-head">
        <div>
          <h3 id="attention-title">Precisa de atenção</h3>
        </div>
      </div>
      <ul>
        {entries.map((entry) => (
          <li key={entry.key} className="attention-entry">
            <strong>{entry.title}</strong>
            {entry.details.length ? (
              <ul className="attention-details">
                {entry.details.map((detail) => <li key={detail}>{detail}</li>)}
              </ul>
            ) : null}
            <p className="muted">{entry.next}</p>
            {entry.href ? (
              entry.href.startsWith('#')
                ? <a className="table-link" href={entry.href}>{entry.linkLabel}</a>
                : <Link className="table-link" to={entry.href}>{entry.linkLabel}</Link>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
