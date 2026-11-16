import { useEffect, useId, useState } from 'react'
import { apiRequest, buildQueryString } from '../lib/api'

export type CustomerOption = {
  id: string
  email: string
  country?: string | null
  profile?: { fullName?: string | null } | null
}

type CustomersResponse = { items: CustomerOption[] }

type CustomerSearchFieldProps = {
  token: string | null
  label?: string
  value: CustomerOption | null
  onChange: (customer: CustomerOption | null) => void
  disabled?: boolean
  // 'filter' fits a FiltersBar cell: the results float over the page and the choice clears with an ×.
  variant?: 'form' | 'filter'
}

const MIN_QUERY = 2
const DEBOUNCE_MS = 300

function customerLabel(customer: CustomerOption) {
  return customer.profile?.fullName || customer.email || `Cliente #${customer.id}`
}

// Finds a customer by name or e-mail (GET /admin/users?q=) so the operator never has to know the internal id.
export function CustomerSearchField({ token, label = 'Cliente', value, onChange, disabled, variant = 'form' }: CustomerSearchFieldProps) {
  const isFilter = variant === 'filter'
  const rootClass = isFilter ? 'customer-search customer-search-filter' : 'customer-search'
  const listId = useId()
  const [query, setQuery] = useState('')
  // The answer remembers which term it belongs to, so a stale answer reads as "still searching".
  const [found, setFound] = useState<{ term: string; items: CustomerOption[]; error: string }>({ term: '', items: [], error: '' })
  const term = query.trim()
  const searching = Boolean(token) && !value && term.length >= MIN_QUERY

  useEffect(() => {
    if (!searching || !token) return
    let cancelled = false
    const timer = window.setTimeout(async () => {
      try {
        const response = await apiRequest<CustomersResponse>(
          `/admin/users${buildQueryString({ q: term, page: 1, perPage: 8 })}`,
          { token },
        )
        if (!cancelled) setFound({ term, items: response.items, error: '' })
      } catch (requestError) {
        if (!cancelled) {
          setFound({ term, items: [], error: requestError instanceof Error ? requestError.message : 'Falha ao buscar clientes' })
        }
      }
    }, DEBOUNCE_MS)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [searching, token, term])

  const loading = searching && found.term !== term
  const results = loading ? [] : found.items
  const error = loading ? '' : found.error

  if (value && isFilter) {
    return (
      <div className={rootClass}>
        <span className="customer-search-label">{label}</span>
        <span className="filter-field">
          <span className="customer-search-chip" title={value.email}>{customerLabel(value)}</span>
          <button
            type="button"
            className="filter-clear"
            aria-label={`Limpar ${label.toLowerCase()}`}
            disabled={disabled}
            onClick={() => { setQuery(''); onChange(null) }}
          >
            ×
          </button>
        </span>
      </div>
    )
  }

  if (value) {
    return (
      <div className={rootClass}>
        <span className="customer-search-label">{label}</span>
        <div className="customer-search-selected">
          <div>
            <strong>{customerLabel(value)}</strong>
            {value.profile?.fullName && value.email ? <span className="muted">{value.email}</span> : null}
          </div>
          <button
            type="button"
            className="ghost-button"
            disabled={disabled}
            onClick={() => { setQuery(''); onChange(null) }}
          >
            Trocar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={rootClass}>
      <label>
        {label}
        <input
          type="search"
          value={query}
          disabled={disabled}
          autoComplete="off"
          aria-controls={listId}
          placeholder="Nome ou e-mail do cliente"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {term.length >= MIN_QUERY ? (
        <div id={listId} className="customer-search-results" aria-live="polite">
          {loading ? <p className="muted">Buscando…</p> : null}
          {error ? <p className="alert" role="alert">{error}</p> : null}
          {!loading && !error && results.length === 0 ? <p className="muted">Nenhum cliente encontrado.</p> : null}
          {!loading && results.length > 0 ? (
            <ul>
              {results.map((customer) => (
                <li key={customer.id}>
                  <button type="button" onClick={() => onChange(customer)}>
                    <strong>{customerLabel(customer)}</strong>
                    <span className="muted">{customer.profile?.fullName ? customer.email : null}{customer.country ? ` · ${customer.country}` : ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : isFilter ? null : (
        <p className="muted customer-search-hint">Digite pelo menos {MIN_QUERY} letras do nome ou do e-mail.</p>
      )}
    </div>
  )
}
