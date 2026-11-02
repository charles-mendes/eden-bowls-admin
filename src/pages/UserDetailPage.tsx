import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AccessFields } from '../components/AccessFields'
import { accessFormError, accessFormFrom, accessRoleBody, emptyAccessForm, inviteNeedsResend, type AccessForm } from '../lib/accessForm'
import { CheckoutSnapshotPanels } from '../components/CheckoutSnapshotPanels'
import { MetaGrid } from '../components/MetaGrid'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { useAuth } from '../contexts/AuthContext'
import { ApiRequestError, apiRequest } from '../lib/api'
import { parseCheckoutSnapshots } from '../lib/checkoutSnapshot'
import { formatDate, formatStripeStatus } from '../lib/format'
import {
  accountStatusBadgeClass,
  accountStatusLabel,
  canToggleCustomerStatus,
  isDeactivatedStatus,
  isStaffAccount,
} from '../lib/accountStatus'
import { MARKET_LABELS, type MarketCode } from '../lib/markets'
import { BR_STATES, maskCpf } from '../lib/nfe'
import { formatConsentSource, formatConsentStatus, formatConsentType, formatPrivacyIdentity, formatPrivacyStatus, formatPrivacyType, type UserPrivacySnapshot } from '../lib/privacy'

type UserDetail = {
  id: string
  email: string
  status: string
  createdAt?: string | null
  roles?: string[]
  storedRoles?: string[]
  markets?: MarketCode[]
  lockedByAllowlist?: boolean
  inviteMailStatus?: string | null
  inviteExpired?: boolean
  deletedAt?: string | null
  profile: { fullName: string | null; phone: string | null } | null
  // Sent only to who holds users.delivery.write.
  fiscal?: { fullName: string | null; cpf: string | null }
  delivery: {
    country?: MarketCode
    address: string
    number?: string
    neighborhood?: string
    complement: string
    city: string
    state: string
    zipCode: string
    deliveryInstructions: string
  } | null
  subscriptions?: Array<{ id: string; stripeSubscriptionId: string; status: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; planLabel: string | null }>
}

// Pets and checkout come from the onboarding record; it is fetched only when one of those tabs opens.
type OnboardingDetail = {
  empty: boolean
  updatedAt: string | null
  pets: Array<{ id: string; name: string; breed: string; ageYears: number; ageMonths: number; weightInput: number; weightUnit: string; activityLevel: string; neutered?: boolean; simplified?: { daily?: { formatted?: string } } | null }>
  recurrence: unknown
  planSelection: unknown
  address: unknown
  shipping: unknown
  discount: { promotionCodeId?: string | null; percent?: number | null; eligibilityReason?: string | null; amountPaid?: number | null }
  lineItems: unknown[]
  checkoutReference: unknown
  paymentReference: unknown
}

type OnboardingState =
  | { status: 'loading' | 'forbidden' }
  | { status: 'ready'; data: OnboardingDetail }
  | { status: 'error'; message: string }

type CustomerTab = 'cadastro' | 'pets' | 'assinaturas' | 'checkout'

// Stripe status → semantic badge; anything unknown stays neutral.
function subscriptionBadgeClass(status: string) {
  if (status === 'active' || status === 'trialing') return 'badge-success'
  if (status === 'past_due' || status === 'unpaid' || status === 'incomplete') return 'badge-warning'
  if (status === 'canceled' || status === 'incomplete_expired') return 'badge-neutral'
  return 'badge-info'
}

function formatPetAge(years: number, months: number) {
  if (!years && !months) return '-'
  const parts = []
  if (years) parts.push(`${years} ${years === 1 ? 'ano' : 'anos'}`)
  if (months) parts.push(`${months} ${months === 1 ? 'mês' : 'meses'}`)
  return parts.join(' e ')
}

const TABS: Array<{ id: CustomerTab; label: string }> = [
  { id: 'cadastro', label: 'Cadastro' },
  { id: 'pets', label: 'Pets' },
  { id: 'assinaturas', label: 'Assinaturas' },
  { id: 'checkout', label: 'Checkout' },
]

type DeliveryForm = {
  address: string
  number: string
  neighborhood: string
  complement: string
  city: string
  state: string
  zipCode: string
  deliveryInstructions: string
}

const emptyDelivery = (): DeliveryForm => ({
  address: '',
  number: '',
  neighborhood: '',
  complement: '',
  city: '',
  state: '',
  zipCode: '',
  deliveryInstructions: '',
})

function deliveryFromUser(user: UserDetail | null): DeliveryForm {
  return {
    address: user?.delivery?.address || '',
    number: user?.delivery?.number || '',
    neighborhood: user?.delivery?.neighborhood || '',
    complement: user?.delivery?.complement || '',
    city: user?.delivery?.city || '',
    state: user?.delivery?.state || '',
    zipCode: user?.delivery?.zipCode || '',
    deliveryInstructions: user?.delivery?.deliveryInstructions || '',
  }
}

function deliveryWithoutBrazilFields(delivery: DeliveryForm) {
  const body: Partial<DeliveryForm> = { ...delivery }
  delete body.number
  delete body.neighborhood
  return body
}

export function UserDetailPage() {
  const { token, user, hasPermission } = useAuth()
  const { userId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('aba')
  const tab: CustomerTab = TABS.some((option) => option.id === requestedTab) ? requestedTab as CustomerTab : 'cadastro'
  const [data, setData] = useState<UserDetail | null>(null)
  // Keyed by user so a different customer reads as loading until their own response lands.
  const [onboardingResult, setOnboardingResult] = useState<{ userId: string; state: OnboardingState } | null>(null)
  const onboardingRequestedFor = useRef<string | null>(null)
  const onboarding: OnboardingState = onboardingResult && onboardingResult.userId === userId ? onboardingResult.state : { status: 'loading' }
  const [privacy, setPrivacy] = useState<UserPrivacySnapshot | null>(null)
  const [delivery, setDelivery] = useState<DeliveryForm>(emptyDelivery)
  const [fiscal, setFiscal] = useState({ fullName: '', cpf: '' })
  const [access, setAccess] = useState<AccessForm>(emptyAccessForm)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const canWriteDelivery = hasPermission('users.delivery.write')
  const isBrazil = data?.delivery?.country === 'BR'
  const canWriteStatus = hasPermission('users.status.write')
  const canManageAccess = hasPermission('users.access.write')
  const isStaff = isStaffAccount(data?.roles)
  const isSelf = user?.userId === data?.id
  const deleted = Boolean(data?.deletedAt)
  const canEditAccess = Boolean(data && canManageAccess && !isSelf && !deleted)
  const canDelete = canEditAccess && !data?.lockedByAllowlist
  const canResendInvite = Boolean(data && canEditAccess && isStaff && inviteNeedsResend(data))
  const canToggleStatus = Boolean(
    data
    && (isStaff ? canManageAccess && !data.lockedByAllowlist : canWriteStatus)
    && canToggleCustomerStatus(data.status)
    && !isSelf
    && !deleted,
  )

  const showUser = (response: UserDetail) => {
    setData(response)
    setDelivery(deliveryFromUser(response))
    setFiscal({ fullName: response.fiscal?.fullName || '', cpf: maskCpf(response.fiscal?.cpf || '') })
    setAccess(accessFormFrom(response))
  }

  const load = async () => {
    if (!token || !userId) return
    try {
      setError('')
      const [response, privacySnapshot] = await Promise.all([
        apiRequest<UserDetail>(`/admin/users/${userId}`, { token }),
        apiRequest<UserPrivacySnapshot>(`/admin/users/${userId}/privacy`, { token }).catch(() => null),
      ])
      showUser(response)
      setPrivacy(privacySnapshot)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar cliente')
    }
  }

  useEffect(() => {
    void load()
  }, [token, userId])

  const needsOnboarding = tab === 'pets' || tab === 'checkout'
  useEffect(() => {
    if (!needsOnboarding || !token || !userId || onboardingRequestedFor.current === userId) return
    onboardingRequestedFor.current = userId

    // The backend owns onboarding.read; a 403 becomes its own state, distinct from "no checkout".
    const settle = (state: OnboardingState) => setOnboardingResult({ userId, state })
    apiRequest<OnboardingDetail>(`/admin/onboarding/checkouts/${userId}`, { token })
      .then((response) => settle({ status: 'ready', data: response }))
      .catch((requestError) => {
        if (requestError instanceof ApiRequestError && requestError.status === 403) {
          settle({ status: 'forbidden' })
          return
        }
        settle({ status: 'error', message: requestError instanceof Error ? requestError.message : 'Falha ao carregar onboarding' })
      })
  }, [needsOnboarding, token, userId])

  const selectTab = (next: CustomerTab) => {
    setSearchParams((params) => {
      if (next === 'cadastro') params.delete('aba')
      else params.set('aba', next)
      return params
    })
  }

  // Arrow keys move between tabs, following the WAI-ARIA tabs pattern.
  const moveTabFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    const index = TABS.findIndex((option) => option.id === tab)
    const next = TABS[(index + (event.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length].id
    selectTab(next)
    document.getElementById(`customer-tab-${next}`)?.focus()
  }

  const saveDelivery = async (event: FormEvent) => {
    event.preventDefault()
    if (!token || !userId || !canWriteDelivery) return
    try {
      setError('')
      await apiRequest(`/admin/users/${userId}/delivery`, {
        token,
        method: 'PATCH',
        body: isBrazil ? delivery : deliveryWithoutBrazilFields(delivery),
      })
      setMessage('Endereço salvo.')
      await load()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao salvar endereço')
    }
  }

  const saveFiscal = async (event: FormEvent) => {
    event.preventDefault()
    if (!token || !userId || !canWriteDelivery) return
    try {
      setError('')
      await apiRequest(`/admin/users/${userId}/fiscal`, { token, method: 'PATCH', body: fiscal })
      setMessage('Dados fiscais salvos.')
      await load()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao salvar dados fiscais')
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

  const saveAccess = async (event: FormEvent) => {
    event.preventDefault()
    if (!token || !userId || !canEditAccess) return
    const invalid = accessFormError(access, false)
    if (invalid) {
      setError(invalid)
      return
    }
    try {
      setError('')
      await apiRequest(`/admin/users/${userId}`, {
        token,
        method: 'PATCH',
        body: { name: access.name.trim(), phone: access.phone.trim() || null, ...accessRoleBody(access) },
      })
      setMessage('Conta e acesso salvos.')
      await load()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao salvar conta e acesso')
    }
  }

  const resendInvite = async () => {
    if (!token || !userId || !data || !canResendInvite) return
    if (!window.confirm(`Reenviar convite para ${data.email}? A senha temporária anterior deixa de valer.`)) return
    try {
      setError('')
      const result = await apiRequest<UserDetail>(`/admin/users/${userId}/invite`, { token, method: 'POST' })
      setMessage(result.inviteMailStatus === 'sent' ? `Convite reenviado para ${data.email}.` : `Não foi possível enviar o convite para ${data.email}. Tente de novo.`)
      await load()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao reenviar convite')
    }
  }

  const deleteAccess = async () => {
    if (!token || !userId || !data || !canDelete) return
    if (!window.confirm(`Excluir o acesso de ${data.email}? A conta some da listagem e as sessões são encerradas.`)) return
    try {
      setError('')
      await apiRequest(`/admin/users/${userId}`, { token, method: 'DELETE' })
      navigate('/users')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao excluir acesso')
    }
  }

  const toggleStatus = async () => {
    if (!token || !userId || !data || !canToggleStatus) return
    const nextStatus = isDeactivatedStatus(data.status) ? 'active' : 'inactive'
    const confirmed = window.confirm(
      nextStatus === 'inactive'
        ? 'Desativar esta conta? A pessoa não conseguirá entrar até ser reativada e as sessões ativas serão encerradas.'
        : 'Reativar esta conta? A pessoa voltará a poder entrar.',
    )
    if (!confirmed) return

    try {
      setError('')
      const response = await apiRequest<UserDetail>(`/admin/users/${userId}/status`, {
        token,
        method: 'PATCH',
        body: { status: nextStatus },
      })
      showUser(response)
      setMessage(nextStatus === 'inactive' ? 'Conta desativada.' : 'Conta reativada.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao alterar status da conta')
    }
  }

  const subscriptions = data?.subscriptions ?? []
  const activeSubscriptions = subscriptions.filter((item) => item.status === 'active' || item.status === 'trialing').length
  const roleLabel = data?.roles?.filter((role) => role !== 'customer').join(', ') || 'Cliente'

  return (
    <PageFrame
      eyebrow="Cliente"
      title={data?.profile?.fullName || data?.email || 'Cliente'}
      description={data ? [data.email, data.profile?.phone].filter(Boolean).join(' · ') : 'Carregando…'}
      actions={data ? (
        <div className="customer-actions">
          {canResendInvite ? <button className="ghost-button" type="button" onClick={() => void resendInvite()}>Reenviar convite</button> : null}
          {canToggleStatus ? (
            <button
              className={isDeactivatedStatus(data.status) ? 'primary-button' : 'ghost-button'}
              type="button"
              onClick={() => void toggleStatus()}
            >
              {isDeactivatedStatus(data.status) ? 'Reativar conta' : 'Desativar conta'}
            </button>
          ) : null}
          {canDelete ? <button className="danger-button" type="button" onClick={() => void deleteAccess()}>Excluir acesso</button> : null}
        </div>
      ) : null}
    >
      {error ? <div className="alert">{error}</div> : null}
      {message ? <div className="success" role="status">{message}</div> : null}

      <dl className="customer-summary" aria-label="Resumo do cliente">
        <div>
          <dt>Status</dt>
          <dd><span className={accountStatusBadgeClass(data?.status)}>{accountStatusLabel(data?.status)}</span></dd>
        </div>
        <div>
          <dt>País</dt>
          <dd>{data?.delivery?.country ? MARKET_LABELS[data.delivery.country] : '—'}</dd>
        </div>
        <div>
          <dt>Papel</dt>
          <dd>{roleLabel}{data?.lockedByAllowlist ? ' (ADMIN_EMAILS)' : ''}</dd>
        </div>
        <div>
          <dt>Cliente desde</dt>
          <dd>{data?.createdAt ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(data.createdAt)) : '—'}</dd>
        </div>
        <div>
          <dt>Assinaturas</dt>
          <dd>{data ? `${activeSubscriptions} ativa${activeSubscriptions === 1 ? '' : 's'} de ${subscriptions.length}` : '—'}</dd>
        </div>
      </dl>

      <div className="page-tabs customer-tabs" role="tablist" aria-label="Cliente" onKeyDown={moveTabFocus}>
        {TABS.map((option) => (
          <button
            key={option.id}
            id={`customer-tab-${option.id}`}
            type="button"
            role="tab"
            aria-selected={tab === option.id}
            aria-controls={`customer-panel-${option.id}`}
            tabIndex={tab === option.id ? 0 : -1}
            className={tab === option.id ? 'page-tab active' : 'page-tab'}
            onClick={() => selectTab(option.id)}
          >
            {option.label}
            {option.id === 'assinaturas' && data ? <span className="page-tab-count">{subscriptions.length}</span> : null}
          </button>
        ))}
      </div>

      {tab === 'cadastro' ? (
        <div id="customer-panel-cadastro" role="tabpanel" aria-labelledby="customer-tab-cadastro" className="customer-layout">
          <div className="page-stack">
            {canEditAccess && data ? (
              <Section title="Conta e acesso" description="Nome, telefone e papel no painel.">
                <form className="access-form" onSubmit={saveAccess}>
                  <AccessFields form={access} setForm={setAccess} account={data} />
                  <div className="form-footer">
                    <button className="primary-button" type="submit">Salvar conta e acesso</button>
                  </div>
                </form>
              </Section>
            ) : null}

            {isBrazil && data?.fiscal ? (
              <Section title="Dados fiscais" description="Usados na próxima NF-e e na nova tentativa de uma nota com erro. Uma nota autorizada não muda.">
                <form onSubmit={saveFiscal}>
                  <div className="address-fields">
                    <label className="address-street">
                      Nome completo
                      <input
                        value={fiscal.fullName}
                        autoComplete="off"
                        maxLength={60}
                        required
                        onChange={(event) => setFiscal((current) => ({ ...current, fullName: event.target.value }))}
                      />
                    </label>
                    <label className="address-complement">
                      CPF
                      <input
                        value={fiscal.cpf}
                        autoComplete="off"
                        inputMode="numeric"
                        maxLength={14}
                        required
                        onChange={(event) => setFiscal((current) => ({ ...current, cpf: maskCpf(event.target.value) }))}
                      />
                    </label>
                  </div>
                  <div className="form-footer">
                    <button className="primary-button" type="submit">Salvar dados fiscais</button>
                  </div>
                </form>
              </Section>
            ) : null}

            <Section title="Endereço de entrega" description="O mesmo endereço do app do cliente.">
              <form onSubmit={saveDelivery}>
                <div className="address-fields">
                  <label className="address-street">
                    Endereço
                    <input
                      value={delivery.address}
                      autoComplete="off"
                      onChange={(event) => setDelivery((current) => ({ ...current, address: event.target.value }))}
                      disabled={!canWriteDelivery}
                    />
                  </label>
                  {isBrazil ? (
                    <label className="address-number">
                      Número
                      <input
                        value={delivery.number}
                        autoComplete="off"
                        required
                        onChange={(event) => setDelivery((current) => ({ ...current, number: event.target.value }))}
                        disabled={!canWriteDelivery}
                      />
                    </label>
                  ) : null}
                  <label className="address-complement">
                    Complemento
                    <input
                      value={delivery.complement}
                      autoComplete="off"
                      onChange={(event) => setDelivery((current) => ({ ...current, complement: event.target.value }))}
                      disabled={!canWriteDelivery}
                    />
                  </label>
                  {isBrazil ? (
                    <label className="address-neighborhood">
                      Bairro
                      <input
                        value={delivery.neighborhood}
                        autoComplete="off"
                        required
                        onChange={(event) => setDelivery((current) => ({ ...current, neighborhood: event.target.value }))}
                        disabled={!canWriteDelivery}
                      />
                    </label>
                  ) : null}
                  <label className="address-city">
                    Cidade
                    <input
                      value={delivery.city}
                      autoComplete="off"
                      onChange={(event) => setDelivery((current) => ({ ...current, city: event.target.value }))}
                      disabled={!canWriteDelivery}
                    />
                  </label>
                  <label className="address-state">
                    Estado
                    {isBrazil ? (
                      <select
                        value={BR_STATES.includes(delivery.state) ? delivery.state : ''}
                        required
                        onChange={(event) => setDelivery((current) => ({ ...current, state: event.target.value }))}
                        disabled={!canWriteDelivery}
                      >
                        <option value="">UF</option>
                        {BR_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
                      </select>
                    ) : (
                      <input
                        value={delivery.state}
                        autoComplete="off"
                        onChange={(event) => setDelivery((current) => ({ ...current, state: event.target.value }))}
                        disabled={!canWriteDelivery}
                      />
                    )}
                  </label>
                  <label className="address-zip">
                    CEP
                    <input
                      value={delivery.zipCode}
                      autoComplete="off"
                      inputMode="numeric"
                      onChange={(event) => setDelivery((current) => ({ ...current, zipCode: event.target.value }))}
                      disabled={!canWriteDelivery}
                    />
                  </label>
                </div>
                {canWriteDelivery ? (
                  <div className="form-footer">
                    <button className="primary-button" type="submit">Salvar endereço</button>
                  </div>
                ) : null}
              </form>
            </Section>

            <Section title="Instruções de entrega" description="Portão, local de entrega ou cuidados com o pet, para quem entrega.">
              <form className="stack" onSubmit={saveInstructions}>
                <label>
                  Instruções
                  <textarea
                    rows={4}
                    value={delivery.deliveryInstructions}
                    onChange={(event) => setDelivery((current) => ({ ...current, deliveryInstructions: event.target.value }))}
                    disabled={!canWriteDelivery}
                  />
                </label>
                {canWriteDelivery ? (
                  <div className="form-footer">
                    <button className="primary-button" type="submit">Salvar instruções</button>
                  </div>
                ) : null}
              </form>
            </Section>
          </div>

          <Section
            title="Privacidade"
            description="Consentimentos e pedidos sobre os dados do cliente."
          >
            <div className="page-stack">
              <MetaGrid
                items={[
                  { label: 'E-mails de marketing', value: formatConsentStatus(privacy?.marketingOptIn ? 'granted' : 'denied') },
                  { label: 'Cookies analíticos', value: formatConsentStatus(privacy?.cookiePreferences?.analytics) },
                  { label: 'Cookies de anúncios', value: formatConsentStatus(privacy?.cookiePreferences?.ads) },
                ]}
              />
              {privacy?.consents?.length ? (
                <ul className="customer-list">
                  {privacy.consents.slice(0, 8).map((consent) => (
                    <li key={consent.id}>
                      <span>{formatConsentType(consent.consentType)}</span>
                      <span className="muted">{formatConsentStatus(consent.status)} · {formatConsentSource(consent.source)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">Sem histórico de consentimento.</p>
              )}
              {privacy?.requests?.length ? (
                <ul className="customer-list">
                  {privacy.requests.map((requestItem) => (
                    <li key={requestItem.id}>
                      <Link className="table-link" to={`/privacy/requests/${requestItem.id}`}>
                        #{requestItem.id} {formatPrivacyType(requestItem.type)}
                      </Link>
                      <span className="muted">{formatPrivacyStatus(requestItem.status)} · {formatPrivacyIdentity(requestItem.identityStatus)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="inline-actions">
                <Link className="ghost-button" to={`/privacy/requests?userId=${userId}`}>Ver solicitações</Link>
              </div>
            </div>
          </Section>
        </div>
      ) : null}

      {tab === 'assinaturas' ? (
        <div id="customer-panel-assinaturas" role="tabpanel" aria-labelledby="customer-tab-assinaturas">
          <Section title="Assinaturas Stripe" description="Assinaturas deste cliente na Stripe.">
            {data && !subscriptions.length ? <p className="empty-note">Nenhuma assinatura.</p> : (
              <div className="table-shell">
                <table className="stack-table">
                  <thead>
                    <tr>
                      <th>Assinatura</th>
                      <th>Status</th>
                      <th>Plano</th>
                      <th>Fim do período</th>
                      <th>Cancelando</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.map((item) => (
                      <tr key={item.id}>
                        <td className="stack-table-title"><Link className="table-link" to={`/billing/subscriptions/${item.id}`}>{item.stripeSubscriptionId}</Link></td>
                        <td data-label="Status"><span className={subscriptionBadgeClass(item.status)}>{formatStripeStatus(item.status)}</span></td>
                        <td data-label="Plano">{item.planLabel ?? '-'}</td>
                        <td data-label="Fim do período" className="nowrap">{formatDate(item.currentPeriodEnd)}</td>
                        <td data-label="Cancelando">{item.cancelAtPeriodEnd ? 'Sim' : 'Não'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>
      ) : null}

      {needsOnboarding ? (
        <div id={`customer-panel-${tab}`} role="tabpanel" aria-labelledby={`customer-tab-${tab}`} className="page-stack">
          <OnboardingPanel tab={tab} state={onboarding} />
        </div>
      ) : null}
    </PageFrame>
  )
}

function OnboardingPanel({ tab, state }: { tab: CustomerTab; state: OnboardingState }) {
  if (state.status === 'forbidden') {
    return <div className="warning">Seu papel não tem acesso aos dados de onboarding deste cliente.</div>
  }
  if (state.status === 'error') {
    return <div className="alert">{state.message}</div>
  }
  if (state.status !== 'ready') {
    return <p className="muted" aria-busy="true">Carregando…</p>
  }

  const { data } = state
  if (tab === 'pets') {
    return (
      <Section title="Pets" description="Pets atuais do cliente. Sem nome aparece como Pet sem nome.">
        {data.pets.length ? (
          <ul className="pet-grid">
            {data.pets.map((item) => (
              <li key={item.id} className="pet-card">
                <div className="pet-card-head">
                  <h4>{item.name}</h4>
                  <span className="muted">{item.breed || 'Raça não informada'}</span>
                </div>
                <dl className="pet-card-meta">
                  <div><dt>Idade</dt><dd>{formatPetAge(item.ageYears, item.ageMonths)}</dd></div>
                  <div><dt>Peso</dt><dd>{item.weightInput} {item.weightUnit}</dd></div>
                  <div><dt>Atividade</dt><dd>{item.activityLevel || '-'}</dd></div>
                  {item.neutered !== undefined ? <div><dt>Castrado</dt><dd>{item.neutered ? 'Sim' : 'Não'}</dd></div> : null}
                </dl>
                <p className="pet-card-foot">
                  <span className="muted">Porção diária</span>
                  <span>{item.simplified?.daily?.formatted ?? 'Sem dados simplificados'}</span>
                </p>
              </li>
            ))}
          </ul>
        ) : <p className="empty-note">Nenhum pet cadastrado.</p>}
      </Section>
    )
  }

  if (data.empty) {
    return <p className="empty-note">Este cliente ainda não fez checkout.</p>
  }

  return (
    <>
      <p className="muted checkout-updated">Gravado no checkout · atualizado em {formatDate(data.updatedAt)}</p>
      <CheckoutSnapshotPanels
        snapshots={parseCheckoutSnapshots(data)}
        raw={{
          planSelection: data.planSelection,
          address: data.address,
          shipping: data.shipping,
          lineItems: data.lineItems,
          checkoutReference: data.checkoutReference,
          paymentReference: data.paymentReference,
          recurrence: data.recurrence,
        }}
      />
    </>
  )
}
