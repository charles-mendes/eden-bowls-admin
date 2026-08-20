import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest } from '../lib/api'

type UserDetail = {
  id: string
  email: string
  status: string
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

export function UserDetailPage() {
  const { token, hasPermission } = useAuth()
  const { userId } = useParams()
  const [data, setData] = useState<UserDetail | null>(null)
  const [instructions, setInstructions] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    if (!token || !userId) return
    try {
      setError('')
      const response = await apiRequest<UserDetail>(`/admin/users/${userId}`, { token })
      setData(response)
      setInstructions(response.delivery?.deliveryInstructions || '')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar cliente')
    }
  }

  useEffect(() => {
    void load()
  }, [token, userId])

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!token || !userId) return
    try {
      await apiRequest(`/admin/users/${userId}/delivery-instructions`, {
        token,
        method: 'PATCH',
        body: { deliveryInstructions: instructions },
      })
      setMessage('Instruções salvas.')
      await load()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao salvar instruções')
    }
  }

  return (
    <PageFrame title={data?.email ?? 'Cliente'} description="Mesmo campo de instruções de entrega do app do cliente.">
      {error ? <div className="alert">{error}</div> : null}
      {message ? <div className="success">{message}</div> : null}

      <Section title="Identidade">
        <p>{data?.profile?.fullName ?? '-'} · {data?.status}</p>
        <p className="muted">{data?.profile?.phone || 'sem telefone'}</p>
        <div className="inline-actions">
          <Link className="ghost-button" to={`/onboarding/sessions/${userId}`}>Onboarding 360</Link>
          <Link className="ghost-button" to={`/orders/${userId}`}>Checkout</Link>
        </div>
      </Section>

      <Section title="Endereço">
        <p>{data?.delivery?.address || '-'}</p>
        <p className="muted">{data?.delivery?.city} {data?.delivery?.state} {data?.delivery?.zipCode}</p>
      </Section>

      <Section title="Delivery instructions" description="Special instructions for delivery drivers, gate code, preferred drop-off location, or pet safety notes.">
        <form className="stack" onSubmit={save}>
          <textarea rows={6} value={instructions} onChange={(event) => setInstructions(event.target.value)} />
          {hasPermission('users.delivery.write') ? <button className="primary-button" type="submit">Salvar instruções</button> : null}
        </form>
      </Section>
    </PageFrame>
  )
}
