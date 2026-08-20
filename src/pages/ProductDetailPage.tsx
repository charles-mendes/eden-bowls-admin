import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest } from '../lib/api'

type ProductDetail = {
  id: string
  slug: string
  namePt: string
  nameEn: string
  active: boolean
  planCountry: string | null
  planDays: number | null
  publishBlocked?: boolean
  gaps?: Array<{ variationId: string; currencies: string[] }>
  variants: Array<{
    id: string
    sku: string
    name: string
    regularPrice: number | null
    stripeProductId: string | null
    stripePriceId: string | null
    syncStatus: string
    requiresSync: boolean
  }>
}

export function ProductDetailPage() {
  const { token, hasPermission } = useAuth()
  const { productId } = useParams()
  const [data, setData] = useState<ProductDetail | null>(null)
  const [planCountry, setPlanCountry] = useState('BR')
  const [planDays, setPlanDays] = useState(28)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    if (!token || !productId) return
    try {
      const response = await apiRequest<ProductDetail>(`/admin/catalog/products/${productId}`, { token })
      setData(response)
      setPlanCountry(response.planCountry || 'BR')
      setPlanDays(response.planDays || 28)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar produto')
    }
  }

  useEffect(() => {
    void load()
  }, [token, productId])

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!token || !productId) return
    try {
      const response = await apiRequest<ProductDetail>(`/admin/catalog/products/${productId}`, {
        token,
        method: 'PATCH',
        body: { planCountry, planDays },
      })
      setData(response)
      setMessage('Produto atualizado.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao salvar')
    }
  }

  const togglePublish = async (active: boolean) => {
    if (!token || !productId) return
    try {
      const response = await apiRequest<ProductDetail>(`/admin/catalog/products/${productId}`, {
        token,
        method: 'PATCH',
        body: { active },
      })
      setData(response)
      setMessage(response.publishBlocked ? 'Publish bloqueado: faltam prices Stripe.' : (active ? 'Publicado.' : 'Voltou para rascunho.'))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha no publish')
    }
  }

  const sync = async () => {
    if (!token || !productId) return
    try {
      const response = await apiRequest<{ status: string; summary?: { created?: number; updated?: number; skipped?: unknown[] } }>(`/admin/catalog/sync/${productId}`, {
        token,
        method: 'POST',
      })
      setMessage(`Sync ${response.status}. created=${response.summary?.created ?? 0} updated=${response.summary?.updated ?? 0}`)
      await load()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha no sync')
    }
  }

  return (
    <PageFrame title={data?.namePt ?? 'Produto'} description="País, dias, variações e guard de publish sem price mapeado.">
      {error ? <div className="alert">{error}</div> : null}
      {message ? <div className="success">{message}</div> : null}
      {data?.gaps?.length ? <div className="alert">Gaps: {data.gaps.map((item) => `${item.variationId} ${item.currencies.join('/')}`).join(', ')}</div> : null}

      <form className="editor-card form-grid" onSubmit={save}>
        <label>
          País do plano
          <select value={planCountry} onChange={(event) => setPlanCountry(event.target.value)}>
            <option value="BR">BR / BRL</option>
            <option value="US">US / USD</option>
          </select>
        </label>
        <label>
          Duração (dias)
          <input type="number" min={1} value={planDays} onChange={(event) => setPlanDays(Number(event.target.value))} />
        </label>
        {hasPermission('catalog.write') ? <button className="primary-button" type="submit">Salvar</button> : null}
      </form>

      <Section title="Publicação e sync">
        <div className="inline-actions">
          {hasPermission('catalog.write') ? (
            <button className="ghost-button" type="button" onClick={() => void togglePublish(!data?.active)}>
              {data?.active ? 'Voltar para rascunho' : 'Publicar'}
            </button>
          ) : null}
          {hasPermission('catalog.sync') ? (
            <button className="primary-button" type="button" onClick={() => void sync()}>Sincronizar Stripe</button>
          ) : null}
        </div>
        <p className="muted">Ativo: {data?.active ? 'sim' : 'não'} · slug {data?.slug}</p>
      </Section>

      <Section title="Variações">
        <div className="table-shell table-scroll">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Nome</th>
                <th>Preço</th>
                <th>Stripe product</th>
                <th>Stripe price</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data?.variants.map((item) => (
                <tr key={item.id}>
                  <td>{item.sku}</td>
                  <td>{item.name}</td>
                  <td>{item.regularPrice ?? '-'}</td>
                  <td>{item.stripeProductId ?? '-'}</td>
                  <td>{item.stripePriceId ?? '-'}</td>
                  <td>{item.syncStatus}{item.requiresSync ? ' · requires_sync' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </PageFrame>
  )
}
