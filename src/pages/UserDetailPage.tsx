import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest } from '../lib/api'
import {
  accountStatusBadgeClass,
  accountStatusLabel,
  canToggleCustomerStatus,
  isDeactivatedStatus,
  isStaffAccount,
} from '../lib/accountStatus'

type UserDetail = {
  id: string
  email: string
  status: string
  roles?: string[]
  lockedByAllowlist?: boolean
  profile: { fullName: string | null; phone: string | null } | null
  delivery: {
    address: string
    complement: string
    city: string
    state: string
    zipCode: string
    deliveryInstructions: string
  } | null
}

type DeliveryForm = {
  address: string
  complement: string
  city: string
  state: string
  zipCode: string
  deliveryInstructions: string
}

const emptyDelivery = (): DeliveryForm => ({
  address: '',
  complement: '',
  city: '',
  state: '',
  zipCode: '',
  deliveryInstructions: '',
})

function deliveryFromUser(user: UserDetail | null): DeliveryForm {
  return {
    address: user?.delivery?.address || '',
    complement: user?.delivery?.complement || '',
    city: user?.delivery?.city || '',
    state: user?.delivery?.state || '',
    zipCode: user?.delivery?.zipCode || '',
    deliveryInstructions: user?.delivery?.deliveryInstructions || '',
  }
}

export function UserDetailPage() {
  const { token, user, hasPermission } = useAuth()
  const { userId } = useParams()
  const [data, setData] = useState<UserDetail | null>(null)
  const [delivery, setDelivery] = useState<DeliveryForm>(emptyDelivery)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const canWriteDelivery = hasPermission('users.delivery.write')
  const canWriteStatus = hasPermission('users.status.write')
  const isCustomer = !isStaffAccount(data?.roles)
  const canToggleStatus = Boolean(
    data
    && canWriteStatus
    && isCustomer
    && canToggleCustomerStatus(data.status)
    && user?.userId !== data.id,
  )

  const load = async () => {
    if (!token || !userId) return
    try {
      setError('')
      const response = await apiRequest<UserDetail>(`/admin/users/${userId}`, { token })
      setData(response)
      setDelivery(deliveryFromUser(response))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar cliente')
    }
  }

  useEffect(() => {
    void load()
  }, [token, userId])

  const saveDelivery = async (event: FormEvent) => {
    event.preventDefault()
    if (!token || !userId || !canWriteDelivery) return
    try {
      setError('')
      await apiRequest(`/admin/users/${userId}/delivery`, {
        token,
        method: 'PATCH',
        body: delivery,
      })
      setMessage('Endereço salvo.')
      await load()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao salvar endereço')
    }
  }

  const saveInstructions = async (event: FormEvent) => {
    event.preventDefault()
    if (!token || !userId || !canWriteDelivery) return
    try {
      setError('')
      await apiRequest(`/admin/users/${userId}/delivery-instructions`, {
        token,
        method: 'PATCH',
        body: { deliveryInstructions: delivery.deliveryInstructions },
      })
      setMessage('Instruções salvas.')
      await load()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao salvar instruções')
    }
  }

  const toggleStatus = async () => {
    if (!token || !userId || !data || !canToggleStatus) return
    const nextStatus = isDeactivatedStatus(data.status) ? 'active' : 'inactive'
    const confirmed = window.confirm(
      nextStatus === 'inactive'
        ? 'Desativar esta conta? O cliente não conseguirá entrar na loja até ser reativado.'
        : 'Reativar esta conta? O cliente voltará a poder entrar na loja.',
    )
    if (!confirmed) return

    try {
      setError('')
      const response = await apiRequest<UserDetail>(`/admin/users/${userId}/status`, {
        token,
        method: 'PATCH',
        body: { status: nextStatus },
      })
      setData(response)
      setDelivery(deliveryFromUser(response))
      setMessage(nextStatus === 'inactive' ? 'Conta desativada.' : 'Conta reativada.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao alterar status da conta')
    }
  }

  return (
    <PageFrame title={data?.email ?? 'Cliente'} description="Cadastro, endereço de entrega e status da conta.">
      {error ? <div className="alert">{error}</div> : null}
      {message ? <div className="success">{message}</div> : null}

      <Section title="Identidade">
        <p>{data?.profile?.fullName ?? '-'} · <span className={accountStatusBadgeClass(data?.status)}>{accountStatusLabel(data?.status)}</span></p>
        <p className="muted">{data?.profile?.phone || 'sem telefone'}</p>
        <p>Papel: {data?.roles?.filter((role) => role !== 'customer').join(', ') || 'cliente'}{data?.lockedByAllowlist ? ' (ADMIN_EMAILS)' : ''}</p>
        <div className="inline-actions">
          <Link className="ghost-button" to={`/onboarding/sessions/${userId}`}>Onboarding 360</Link>
          {hasPermission('users.roles.write') ? <Link className="ghost-button" to="/users/roles">Alterar papéis</Link> : null}
          {canToggleStatus ? (
            <button
              className={isDeactivatedStatus(data?.status) ? 'primary-button' : 'danger-button'}
              type="button"
              onClick={() => void toggleStatus()}
            >
              {isDeactivatedStatus(data?.status) ? 'Reativar conta' : 'Desativar conta'}
            </button>
          ) : null}
        </div>
      </Section>

      <Section title="Endereço" description="Mesmo endereço de entrega do app do cliente.">
        <form className="form-grid" onSubmit={saveDelivery}>
          <label>
            Endereço
            <input
              value={delivery.address}
              onChange={(event) => setDelivery((current) => ({ ...current, address: event.target.value }))}
              disabled={!canWriteDelivery}
            />
          </label>
          <label>
            Complemento
            <input
              value={delivery.complement}
              onChange={(event) => setDelivery((current) => ({ ...current, complement: event.target.value }))}
              disabled={!canWriteDelivery}
            />
          </label>
          <label>
            Cidade
            <input
              value={delivery.city}
              onChange={(event) => setDelivery((current) => ({ ...current, city: event.target.value }))}
              disabled={!canWriteDelivery}
            />
          </label>
          <label>
            Estado
            <input
              value={delivery.state}
              onChange={(event) => setDelivery((current) => ({ ...current, state: event.target.value }))}
              disabled={!canWriteDelivery}
            />
          </label>
          <label>
            CEP
            <input
              value={delivery.zipCode}
              onChange={(event) => setDelivery((current) => ({ ...current, zipCode: event.target.value }))}
              disabled={!canWriteDelivery}
            />
          </label>
          {canWriteDelivery ? <button className="primary-button" type="submit">Salvar endereço</button> : null}
        </form>
      </Section>

      <Section title="Delivery instructions" description="Special instructions for delivery drivers, gate code, preferred drop-off location, or pet safety notes.">
        <form className="stack" onSubmit={saveInstructions}>
          <label>
            Instruções
            <textarea
              rows={6}
              value={delivery.deliveryInstructions}
              onChange={(event) => setDelivery((current) => ({ ...current, deliveryInstructions: event.target.value }))}
              disabled={!canWriteDelivery}
            />
          </label>
          {canWriteDelivery ? <button className="primary-button" type="submit">Salvar instruções</button> : null}
        </form>
      </Section>
    </PageFrame>
  )
}
