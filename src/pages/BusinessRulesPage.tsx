import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { Pager } from '../components/Pager'
import { FiltersBar } from '../components/FiltersBar'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest, buildQueryString } from '../lib/api'
import { formatDate, formatJson } from '../lib/format'

type BusinessRule = {
  id: string
  domain: string
  key: string
  marketCountry: string
  active: boolean
  effectiveFrom: string
  effectiveTo: string | null
  valueJson: unknown
  createdAt: string
  updatedAt: string
}

type RulesResponse = {
  total: number
  page: number
  perPage: number
  totalPages: number
  items: BusinessRule[]
}

export function BusinessRulesPage() {
  const { token } = useAuth()
  const [data, setData] = useState<RulesResponse | null>(null)
  const [domain, setDomain] = useState('')
  const [key, setKey] = useState('')
  const [marketCountry, setMarketCountry] = useState('')
  const [active, setActive] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [selectedRule, setSelectedRule] = useState<BusinessRule | null>(null)
  const [valueJson, setValueJson] = useState('')
  const [effectiveTo, setEffectiveTo] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return

    const load = async () => {
      try {
        setError('')
        const response = await apiRequest<RulesResponse>(`/admin/config/business-rules${buildQueryString({
          domain: domain || undefined,
          key: key || undefined,
          marketCountry: marketCountry || undefined,
          active: active === '' ? undefined : active === 'true',
          page,
          perPage,
        })}`, { token })
        setData(response)
        if (!selectedRule && response.items[0]) {
          setSelectedRule(response.items[0])
          setValueJson(formatJson(response.items[0].valueJson))
          setEffectiveTo(response.items[0].effectiveTo ?? '')
        }
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar regras')
      }
    }

    void load()
  }, [token, domain, key, marketCountry, active, page, perPage])

  const selectedSummary = useMemo(() => {
    if (!selectedRule) return 'Selecione uma regra na tabela.'
    return `${selectedRule.domain} · ${selectedRule.key} · ${selectedRule.marketCountry}`
  }, [selectedRule])

  const submitUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token || !selectedRule) return

    try {
      setError('')
      setSaveMessage('')
      await apiRequest(`/admin/config/business-rules/${selectedRule.id}`, {
        token,
        method: 'PUT',
        body: {
          valueJson: JSON.parse(valueJson),
          effectiveTo: effectiveTo.trim() ? effectiveTo : null,
        },
      })
      setSaveMessage('Regra atualizada com sucesso.')
      const refreshed = await apiRequest<RulesResponse>(`/admin/config/business-rules${buildQueryString({
        domain: domain || undefined,
        key: key || undefined,
        marketCountry: marketCountry || undefined,
        active: active === '' ? undefined : active === 'true',
        page,
        perPage,
      })}`, { token })
      setData(refreshed)
      setSelectedRule(refreshed.items.find((item) => item.id === selectedRule.id) ?? refreshed.items[0] ?? null)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao salvar regra')
    }
  }

  return (
    <PageFrame
      title="Regras de negócio"
      description="Listagem de business rules por domínio, chave, mercado e vigência."
    >
      <Section title="Filtros" description="Localize a regra antes de editar o JSON e a vigência.">
        <FiltersBar>
          <label>
            Domain
            <input value={domain} onChange={(event) => { setDomain(event.target.value); setPage(1) }} />
          </label>
          <label>
            Key
            <input value={key} onChange={(event) => { setKey(event.target.value); setPage(1) }} />
          </label>
          <label>
            Market
            <input value={marketCountry} onChange={(event) => { setMarketCountry(event.target.value.toUpperCase()); setPage(1) }} />
          </label>
          <label>
            Active
            <select value={active} onChange={(event) => { setActive(event.target.value); setPage(1) }}>
              <option value="">Todos</option>
              <option value="true">Ativas</option>
              <option value="false">Inativas</option>
            </select>
          </label>
          <label>
            Por página
            <input type="number" min={1} max={100} value={perPage} onChange={(event) => { setPerPage(Number(event.target.value)); setPage(1) }} />
          </label>
        </FiltersBar>

        {error ? <div className="alert">{error}</div> : null}
        {saveMessage ? <div className="success">{saveMessage}</div> : null}

        <div className="grid cards-2">
          <div className="table-shell table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Domain</th>
                  <th>Key</th>
                  <th>Market</th>
                  <th>Active</th>
                  <th>Effective from</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((item) => (
                  <tr key={item.id} className={selectedRule?.id === item.id ? 'selected-row' : ''} onClick={() => { setSelectedRule(item); setValueJson(formatJson(item.valueJson)); setEffectiveTo(item.effectiveTo ?? '') }}>
                    <td>{item.domain}</td>
                    <td>{item.key}</td>
                    <td>{item.marketCountry}</td>
                    <td>{item.active ? 'Sim' : 'Não'}</td>
                    <td>{formatDate(item.effectiveFrom)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <form className="editor-card" onSubmit={submitUpdate}>
            <h3>Editar regra</h3>
            <div className="muted-panel">{selectedSummary}</div>
            <label>
              valueJson
              <textarea rows={14} value={valueJson} onChange={(event) => setValueJson(event.target.value)} />
            </label>
            <label>
              effectiveTo
              <input value={effectiveTo} onChange={(event) => setEffectiveTo(event.target.value)} placeholder="YYYY-MM-DDTHH:mm:ss.sssZ ou vazio" />
            </label>
            <button className="primary-button" type="submit" disabled={!selectedRule}>Salvar regra</button>
          </form>
        </div>

        <Pager
          page={data?.page ?? page}
          totalPages={data?.totalPages ?? 1}
          onPrev={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => current + 1)}
        />
      </Section>
    </PageFrame>
  )
}
