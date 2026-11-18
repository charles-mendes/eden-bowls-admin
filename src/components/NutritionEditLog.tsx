import { useState } from 'react'
import { formatDate } from '../lib/format'
import { describeAuditEvent, type NutritionAuditEvent } from '../lib/nutritionSettings'

const FIRST_PAGE = 5

function initialsOf(email: string | null) {
  const name = (email ?? '').split('@')[0]
  const parts = name.split(/[._-]+/).filter(Boolean)
  const letters = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2)
  return letters.toUpperCase() || '?'
}

// The audit log of a nutrition settings tab: who changed what and when, newest first.
// `describe` turns an event into its title and lines; by default, the nutrition events.
// `timeZone` shows the times in a market's zone; without it, in the browser's.
export function NutritionEditLog({ events, empty, describe = describeAuditEvent, timeZone }: {
  events: NutritionAuditEvent[] | undefined
  empty: string
  describe?: (event: NutritionAuditEvent) => { title: string; details: string[] }
  timeZone?: string
}) {
  const [expanded, setExpanded] = useState(false)

  if (events === undefined) {
    return <p className="muted">O histórico de edições ainda não está disponível nesta versão da API.</p>
  }
  if (events.length === 0) {
    return <p className="muted">{empty}</p>
  }

  const visible = expanded ? events : events.slice(0, FIRST_PAGE)
  return (
    <>
      <ol className="edit-log" aria-label="Histórico de edições">
        {visible.map((event) => {
          const { title, details } = describe(event)
          return (
            <li key={event.id} className="edit-log-item">
              <span className="edit-log-avatar" aria-hidden="true">{initialsOf(event.actorEmail)}</span>
              <div className="edit-log-body">
                <p className="edit-log-title">{title}</p>
                <p className="edit-log-meta">
                  <span className="edit-log-actor">{event.actorEmail ?? (event.actorUserId === null ? 'Sistema' : 'Usuário removido')}</span>
                  <span aria-hidden="true"> · </span>
                  <time dateTime={event.createdAt}>{timeZone ? formatDate(event.createdAt, timeZone) : formatDate(event.createdAt)}</time>
                </p>
                {details.length ? (
                  <ul className="edit-log-details">
                    {details.map((line) => <li key={line}>{line}</li>)}
                  </ul>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
      {events.length > FIRST_PAGE ? (
        <button className="ghost-button edit-log-more" type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
          {expanded ? 'Mostrar menos' : `Ver todas as ${events.length} edições`}
        </button>
      ) : null}
    </>
  )
}
