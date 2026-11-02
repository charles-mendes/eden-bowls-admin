import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { JsonDetails } from '../components/JsonDetails'
import { MetaGrid } from '../components/MetaGrid'
import { NfeCustomerDialog } from '../components/NfeCustomerDialog'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest } from '../lib/api'
import {
  blingNfeUrl,
  blingSituacaoTone,
  formatNfeAmount,
  formatNfeDate,
  formatNfeNumber,
  formatTaxDocument,
  nfeStatusLabel,
  nfeStatusTone,
  type NfeDetail,
} from '../lib/nfe'

// The API reads Bling every 5 minutes. The page only has to pick that up without a reload.
const DETAIL_REFRESH_MS = 60 * 1000

type Field = { label: string; value: string | number | null | undefined }

// A field with nothing in it says nothing to the operator, so it is left out instead of shown as a dash.
function filled(fields: Field[]) {
  return fields
    .filter((field) => field.value !== null && field.value !== undefined && field.value !== '')
    .map((field) => ({ label: field.label, value: String(field.value) }))
}

function CopyField({ label, value }: { label: string; value: string }) {
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
    <div className="nfe-copy-field">
      <div className="meta-item">
        <dt>{label}</dt>
        <dd className="nfe-mono">{value}</dd>
      </div>
      <button className="ghost-button" type="button" aria-label={`Copiar ${label.toLowerCase()}`} onClick={() => void copy()}>
        {copied ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  )
}

export function NfeDetailPage() {
  const { id } = useParams()
  const { token, hasPermission } = useAuth()
  const [item, setItem] = useState<NfeDetail | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [retrying, setRetrying] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)
  const [editing, setEditing] = useState(false)
  const canRetry = hasPermission('nfe.retry')
  const canEdit = hasPermission('nfe.edit')

  useEffect(() => {
    if (!token || !id) return
    apiRequest<{ success: boolean; data: NfeDetail }>(`/admin/nfe/${id}`, { token })
      .then((response) => setItem(response.data))
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar a nota'))
  }, [token, id, refreshTick])

  useEffect(() => {
    const timer = window.setInterval(() => setRefreshTick((current) => current + 1), DETAIL_REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [])

  const retry = async () => {
    if (!token || !id) return
    try {
      setRetrying(true)
      setError('')
      const response = await apiRequest<{ success: boolean; data: NfeDetail }>(`/admin/nfe/${id}/retry`, { token, method: 'POST' })
      setItem(response.data)
      setMessage(response.data.status === 'pending' ? 'Nova tentativa na fila.' : 'O cliente ainda não tem CPF ou CNPJ válido.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao pedir nova tentativa')
    } finally {
      setRetrying(false)
    }
  }

  const address = item?.customer_address
  const addressLine = address
    ? [address.street, address.number, address.complement, address.neighborhood, address.city, address.state, address.zipcode].filter(Boolean).join(', ')
    : ''
  const number = item ? formatNfeNumber(item) : '—'
  const hasFiles = Boolean(item?.danfe_url || item?.pdf_url || item?.xml_url)

  return (
    <PageFrame
      eyebrow={<Link className="nfe-back" to="/operations/nfe"><span aria-hidden="true">‹</span> Notas fiscais</Link>}
      title={item ? (number === '—' ? `Nota ${item.id}` : `NF-e ${number}`) : 'NF-e'}
      description={item ? `${item.customer_name || 'Cliente não informado'} · ${formatNfeAmount(item)}` : 'Carregando nota...'}
      actions={item ? (
        <div className="nfe-actions">
          {item.bling_nfe_id ? (
            <a className="ghost-button" href={blingNfeUrl(item.bling_nfe_id)} target="_blank" rel="noreferrer">Abrir no Bling</a>
          ) : null}
          {item.can_retry && canRetry ? (
            <button className="primary-button" type="button" disabled={retrying} onClick={() => void retry()}>Nova tentativa</button>
          ) : null}
        </div>
      ) : undefined}
    >
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {message ? <p className="muted" role="status">{message}</p> : null}

      {item ? (
        <div className="nfe-detail">
          <Section title="Situação">
            <dl className="nfe-status-list">
              <div>
                <dt>Status</dt>
                <dd><span className={nfeStatusTone(item.status)}>{nfeStatusLabel(item.status)}</span></dd>
              </div>
              <div>
                <dt>No Bling</dt>
                <dd>
                  {item.bling_situacao_label
                    ? <span className={blingSituacaoTone(item.bling_situacao)}>{item.bling_situacao_label}</span>
                    : '—'}
                </dd>
              </div>
            </dl>
            {item.last_error ? <p className="nfe-alert nfe-alert-error" role="alert">{item.last_error}</p> : null}
            {item.imported ? (
              <p className="nfe-alert">Esta nota foi criada direto no Bling. Aqui ela fica só para consulta e o envio é feito por lá.</p>
            ) : null}
            <MetaGrid items={filled([
              { label: 'Tentativas', value: item.attempts || null },
              { label: 'Próxima tentativa', value: item.next_attempt_at ? formatNfeDate(item.next_attempt_at) : null },
              { label: 'Criada em', value: item.created_at ? formatNfeDate(item.created_at) : null },
              { label: 'Enviada em', value: item.submitted_at ? formatNfeDate(item.submitted_at) : null },
              { label: 'Autorizada em', value: item.authorized_at ? formatNfeDate(item.authorized_at) : null },
            ])} />
          </Section>

          <Section title="Documento fiscal">
            <MetaGrid items={filled([
              { label: 'Número/série', value: number },
              { label: 'Valor', value: formatNfeAmount(item) },
            ])} />
            {item.access_key || item.protocol ? (
              <dl className="nfe-copy-list">
                {item.access_key ? <CopyField label="Chave de acesso" value={item.access_key} /> : null}
                {item.protocol ? <CopyField label="Protocolo" value={item.protocol} /> : null}
              </dl>
            ) : (
              <p className="muted nfe-hint">A chave de acesso, o protocolo e o XML aparecem depois que a SEFAZ autoriza a nota.</p>
            )}
            {hasFiles ? (
              <div className="nfe-files">
                {item.danfe_url ? <a className="ghost-button" href={item.danfe_url} target="_blank" rel="noreferrer">Abrir DANFE</a> : null}
                {item.pdf_url ? <a className="ghost-button" href={item.pdf_url} target="_blank" rel="noreferrer">Abrir PDF</a> : null}
                {item.xml_url ? <a className="ghost-button" href={item.xml_url} target="_blank" rel="noreferrer">Abrir XML</a> : null}
              </div>
            ) : null}
          </Section>

          <Section
            title="Cliente na emissão"
            actions={item.can_edit && canEdit ? (
              <button className="ghost-button" type="button" onClick={() => setEditing(true)}>Corrigir dados</button>
            ) : undefined}
          >
            <MetaGrid items={filled([
              { label: 'Nome', value: item.customer_name },
              { label: 'Documento', value: item.customer_document ? formatTaxDocument(item.customer_document) : null },
              { label: 'E-mail', value: item.customer_email },
              { label: 'Endereço', value: addressLine },
            ])} />
          </Section>

          <section className="nfe-alert nfe-limits" aria-label="Ações feitas no Bling">
            <p><strong>Estas ações não estão disponíveis neste painel</strong>, porque o Bling não as oferece para integrações:</p>
            <ul>
              <li>Cancelar uma nota autorizada</li>
              <li>Emitir carta de correção</li>
              <li>Inutilizar numeração</li>
              <li>Alterar dados de uma nota autorizada</li>
            </ul>
            <p>Faça isso direto no Bling{item.bling_nfe_id ? ', pelo botão Abrir no Bling' : ''}. O cancelamento aparece aqui em poucos minutos.</p>
          </section>

          <details className="section-card nfe-technical">
            <summary>Dados técnicos</summary>
            <MetaGrid items={filled([
              { label: 'Usuário', value: item.user_id },
              { label: 'Conta Stripe', value: item.imported ? null : item.stripe_account },
              { label: 'Assinatura Stripe', value: item.stripe_subscription_id },
              { label: 'Fatura Stripe', value: item.imported ? null : item.stripe_invoice_id },
              { label: 'Contato Bling', value: item.bling_contact_id },
              { label: 'Pedido Bling', value: item.bling_order_id },
              { label: 'NF-e Bling', value: item.bling_nfe_id },
            ])} />
            <JsonDetails title="Enviado ao Bling" value={item.request_payload} />
            <JsonDetails title="Resposta do Bling" value={item.response_payload} />
          </details>
        </div>
      ) : null}

      {item && editing ? (
        <NfeCustomerDialog
          item={item}
          onClose={() => setEditing(false)}
          onSaved={(next) => {
            setItem(next)
            setEditing(false)
            setMessage('Dados salvos. Use Nova tentativa para atualizar a nota no Bling e enviá-la de novo.')
          }}
        />
      ) : null}
    </PageFrame>
  )
}
