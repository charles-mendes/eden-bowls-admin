import { addressIssueState, issueCodeText, issueSourceText, type AddressIssue } from '../lib/addressIssues'

const BADGE: Record<string, string> = {
  warning: 'badge-warning',
  error: 'badge-error',
  success: 'badge-success',
  muted: 'badge-neutral',
}

type Props = {
  issue: AddressIssue | null | undefined
  // The full view lists the codes and the source; a queue row already shows its own `issues`.
  detailed?: boolean
}

// The address problem of a subscription and what the customer was told (delivery-address-issues).
export function AddressIssueStatus({ issue, detailed = false }: Props) {
  if (!issue) return null
  const state = addressIssueState(issue)
  return (
    <div className="stack address-issue">
      {detailed && issue.open ? (
        <ul className="plain-list">
          {issue.codes.map((code) => <li key={code}>{issueCodeText(code)}</li>)}
        </ul>
      ) : null}
      <span><span className={`badge ${BADGE[state.tone]}`}>{state.email}</span></span>
      {state.waiting ? <span className="muted">{state.waiting}</span> : null}
      {detailed ? <span className="muted">Origem: {issueSourceText(issue.source)}</span> : null}
    </div>
  )
}
