import { useEffect, useState, type MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AccessFields } from '../components/AccessFields'
import { accessFormError, accessRoleBody, emptyAccessForm, type AccessForm } from '../lib/accessForm'
import { PageFrame } from '../components/PageFrame'
import { Pager } from '../components/Pager'
import { Dialog } from '../components/Dialog'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest, buildQueryString } from '../lib/api'
import { formatDate } from '../lib/format'
import { accountStatusBadgeClass, accountStatusLabel } from '../lib/accountStatus'
import { MARKET_LABELS, type MarketCode } from '../lib/markets'
import { primaryRole, roleLabel } from '../lib/roles'

type UserItem = {
  id: string
  email: string
  status: string
  createdAt: string
  roles?: string[]
  storedRoles?: string[]
  lockedByAllowlist?: boolean
  mustChangePassword?: boolean
  inviteMailStatus?: string | null
  inviteExpiresAt?: number | null
  inviteExpired?: boolean
  deletedAt?: string | null
  markets?: MarketCode[]
  country?: MarketCode | null
  profile: { fullName: string | null; phone: string | null } | null
}

type UsersResponse = {
  total: number
  page: number
  perPage: number
  totalPages: number
  items: UserItem[]
}

const PER_PAGE_OPTIONS = [10, 20, 50, 100]

export function UsersPage() {
  const { token, user, hasPermission } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState<UsersResponse | null>(null)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [query, setQuery] = useState('')
  const [includeDeleted, setIncludeDeleted] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [form, setForm] = useState<AccessForm>(emptyAccessForm)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const canManageAccess = hasPermission('users.access.write')

  const load = async () => {
    if (!token) return
    try {
      setError('')
      const response = await apiRequest<UsersResponse>(`/admin/users${buildQueryString({
        page,
        perPage,
        q: query || undefined,
        includeDeleted: canManageAccess && includeDeleted ? 1 : undefined,
      })}`, { token })
      setData(response)
    } catch (requestError) {
      setData(null)
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar usuários')
    }
  }

  useEffect(() => {
    void load()
  }, [token, page, perPage, query, includeDeleted, canManageAccess])

  const closeDialog = () => {
    setDialogOpen(false)
    setForm(emptyAccessForm)
    setFormError('')
  }

  const openCreate = () => {
    setForm(emptyAccessForm)
    setDialogOpen(true)
    setMessage('')
    setFormError('')
  }

  const createAccess = async () => {
    if (!token || !canManageAccess) return
    const invalid = accessFormError(form, true)
    if (invalid) {
      setFormError(invalid)
      return
    }

    setSaving(true)
    try {
      setError('')
      setFormError('')
      const created = await apiRequest<UserItem>('/admin/users', {
        token,
        method: 'POST',
        body: {
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim() || undefined,
          ...accessRoleBody(form),
        },
      })
      setMessage(
        created.inviteMailStatus === 'failed' || created.inviteMailStatus === 'skipped'
          ? `Conta de ${created.email} criada, mas o convite não foi enviado — reenviar.`
          : `Acesso criado para ${created.email}. O convite foi enviado.`,
      )
      closeDialog()
      await load()
    } catch (requestError) {
      setFormError(requestError instanceof Error ? requestError.message : 'Falha ao salvar acesso')
    } finally {
      setSaving(false)
    }
  }

  // The row is a shortcut for the mouse. The link inside it stays the way in for keyboard and screen readers.
  const openCustomer = (event: MouseEvent<HTMLTableRowElement>, id: string) => {
    if ((event.target as HTMLElement).closest('a, button')) return
    if (window.getSelection()?.toString()) return
    navigate(`/users/${id}`)
  }

  return (
    <PageFrame
      title="Clientes"
      description="Contas da loja e do painel. Abra uma conta para ver e editar os dados."
      actions={canManageAccess ? (
        <button className="primary-button" type="button" onClick={openCreate}>
          Novo acesso
        </button>
      ) : null}
    >
      <div className="list-toolbar">
        <label className="list-search">
          <span className="sr-only">Busca</span>
          <input
            type="search"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setPage(1) }}
            placeholder="Buscar por e-mail ou nome"
          />
        </label>
        <div className="list-toolbar-end">
          {canManageAccess ? (
            <label className="checkbox-field" title="Contas excluídas ficam escondidas, a menos que você marque esta opção.">
              <input
                type="checkbox"
                checked={includeDeleted}
                onChange={(event) => { setIncludeDeleted(event.target.checked); setPage(1) }}
              />
              Incluir excluídos
            </label>
          ) : null}
          <label className="list-per-page">
            Por página
            <select value={perPage} onChange={(event) => { setPerPage(Number(event.target.value)); setPage(1) }}>
              {PER_PAGE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>
      </div>

      {error ? <div className="alert">{error}</div> : null}
      {message ? <div className="success">{message}</div> : null}

      {data ? (
        <>
        <div className="table-shell table-scroll">
          <table className="users-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>País</th>
                <th>Status</th>
                <th>Papel</th>
                <th>Telefone</th>
                <th>Criado em</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <tr className="users-empty">
                  <td colSpan={6}>Nenhuma conta encontrada{query ? ` para “${query}”` : ''}.</td>
                </tr>
              ) : null}
              {data.items.map((item) => {
                const isSelf = user?.userId === item.id
                const deleted = Boolean(item.deletedAt)
                const name = item.profile?.fullName

                return (
                  <tr key={item.id} className="users-row" onClick={(event) => openCustomer(event, item.id)}>
                    <td className="users-cell-client">
                      <div className="users-client">
                        {name ? <strong className="users-name">{name}</strong> : null}
                        <Link className="table-link" to={`/users/${item.id}`}>{item.email}</Link>
                        {isSelf ? <span className="muted users-note">Sua conta</span> : null}
                        {item.inviteMailStatus === 'failed' ? (
                          <span className="users-note users-note-warning">Convite não enviado — reenviar</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="users-cell-meta" data-label="País">{item.country ? MARKET_LABELS[item.country] : '—'}</td>
                    <td className="users-cell-status">
                      <span className={accountStatusBadgeClass(deleted ? 'deleted' : item.status)}>
                        {accountStatusLabel(deleted ? 'deleted' : item.status)}
                      </span>
                    </td>
                    <td className="users-cell-meta" data-label="Papel">
                      {item.roles?.filter((role) => role !== 'customer').map(roleLabel).join(', ') || 'cliente'}
                      {item.lockedByAllowlist ? <span className="muted users-note">Efetivo: {roleLabel(primaryRole(item.roles))} (allowlist)</span> : null}
                    </td>
                    <td className="users-cell-meta" data-label="Telefone">{item.profile?.phone || '—'}</td>
                    <td className="users-cell-meta" data-label="Criado em">{formatDate(item.createdAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <Pager
          page={data.page}
          totalPages={data.totalPages}
          onPrev={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => current + 1)}
        />
        </>
      ) : null}

      <Dialog
        open={dialogOpen}
        title="Novo acesso"
        description="A conta é criada como Pendente e recebe um convite com senha temporária."
        onClose={closeDialog}
        footer={(
          <>
            <button className="ghost-button" type="button" onClick={closeDialog}>Cancelar</button>
            <button className="primary-button" type="button" onClick={() => void createAccess()} disabled={saving}>
              {saving ? 'Salvando...' : 'Criar acesso'}
            </button>
          </>
        )}
      >
        <form className="access-form" onSubmit={(event) => { event.preventDefault(); void createAccess() }}>
          <AccessFields form={form} setForm={setForm} account={null} />
          {formError ? <div className="alert">{formError}</div> : null}
        </form>
      </Dialog>
    </PageFrame>
  )
}
