import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { JsonDetails } from '../components/JsonDetails'
import { MetaGrid } from '../components/MetaGrid'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest } from '../lib/api'
import {
  formatNfeAmount,
  formatNfeDate,
  formatNfeNumber,
  formatTaxDocument,
  nfeStatusLabel,
  nfeStatusTone,
  type NfeDetail,
} from '../lib/nfe'

const text = (value: string | number | null | undefined) => (value === null || value === undefined || value === '' ? '—' : String(value))

export function NfeDetailPage() {
  const { id } = useParams()
  const { token, hasPermission } = useAuth()
  const [item, setItem] = useState<NfeDetail | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [retrying, setRetrying] = useState(false)
  const canRetry = hasPermission('nfe.retry')

  useEffect(() => {
    if (!token || !id) return
    apiRequest<{ success: boolean; data: NfeDetail }>(`/admin/nfe/${id}`, { token })
      .then((response) => setItem(response.data))
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar a nota'))
  }, [token, id])

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

  return (
    <PageFrame
      eyebrow="Operação"
      title={item ? `NF-e ${formatNfeNumber(item)}` : 'NF-e'}
      description="O que foi enviado ao Bling e o que voltou."
      actions={item?.can_retry && canRetry ? (
        <button className="primary-button" type="button" disabled={retrying} onClick={() => void retry()}>Nova tentativa</button>
      ) : undefined}
    >
      <p><Link className="table-link" to="/operations/nfe">Voltar para notas fiscais</Link></p>
      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="muted">{message}</p> : null}

      {item ? (
        <>
          <Section title="Situação">
            <p>
              <span className={nfeStatusTone(item.status)}>{nfeStatusLabel(item.status)}</span>
              {item.bling_situacao_label ? <span className="muted"> Bling: {item.bling_situacao_label}</span> : null}
            </p>
            {item.last_error ? <p className="form-error">{item.last_error}</p> : null}
            <MetaGrid items={[
              { label: 'Tentativas', value: String(item.attempts) },
              { label: 'Próxima tentativa', value: formatNfeDate(item.next_attempt_at) },
              { label: 'Criada em', value: formatNfeDate(item.created_at) },
              { label: 'Enviada em', value: formatNfeDate(item.submitted_at) },
              { label: 'Autorizada em', value: formatNfeDate(item.authorized_at) },
            ]} />
          </Section>

          <Section title="Documento fiscal">
            <MetaGrid items={[
              { label: 'Número/série', value: formatNfeNumber(item) },
              { label: 'Chave de acesso', value: text(item.access_key) },
              { label: 'Protocolo', value: text(item.protocol) },
              { label: 'Valor', value: formatNfeAmount(item) },
            ]} />
            {item.danfe_url ? <p><a className="table-link" href={item.danfe_url} target="_blank" rel="noreferrer">Abrir DANFE</a></p> : null}
            {item.pdf_url ? <p><a className="table-link" href={item.pdf_url} target="_blank" rel="noreferrer">Abrir PDF</a></p> : null}
            {item.xml_url ? <p><a className="table-link" href={item.xml_url} target="_blank" rel="noreferrer">Abrir XML</a></p> : null}
          </Section>

          <Section title="Cliente na emissão">
            <MetaGrid items={[
              { label: 'Nome', value: text(item.customer_name) },
              { label: 'E-mail', value: text(item.customer_email) },
              { label: 'Documento', value: formatTaxDocument(item.customer_document) },
              { label: 'Endereço', value: text(addressLine) },
            ]} />
          </Section>

          <Section title="Identificadores">
            <MetaGrid items={[
              { label: 'Usuário', value: text(item.user_id) },
              { label: 'Conta Stripe', value: text(item.stripe_account) },
              { label: 'Assinatura Stripe', value: text(item.stripe_subscription_id) },
              { label: 'Fatura Stripe', value: text(item.stripe_invoice_id) },
              { label: 'Contato Bling', value: text(item.bling_contact_id) },
              { label: 'Pedido Bling', value: text(item.bling_order_id) },
              { label: 'NF-e Bling', value: text(item.bling_nfe_id) },
            ]} />
          </Section>

          <Section title="Payload">
            <JsonDetails title="Enviado ao Bling" value={item.request_payload} />
            <JsonDetails title="Resposta do Bling" value={item.response_payload} />
          </Section>
        </>
      ) : null}
    </PageFrame>
  )
}
