import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { Pager } from '../components/Pager'
import { Dialog } from '../components/Dialog'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest, buildQueryString } from '../lib/api'
import { formatDate } from '../lib/format'
import {
  accountStatusBadgeClass,
  accountStatusLabel,
  canToggleCustomerStatus,
  isDeactivatedStatus,
  isStaffAccount,
} from '../lib/accountStatus'
import { MARKET_LABELS, staffMarketRequired, type MarketCode } from '../lib/markets'
import { PANEL_ROLE_OPTIONS, primaryRole, roleLabel } from '../lib/roles'

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
  profile: { fullName: string | null; phone: string | null } | null
}

type UsersResponse = {
  total: number
  page: number
  perPage: number
  totalPages: number
  items: UserItem[]
}

type AccessForm = {
  name: string
  email: string
  phone: string
  role: string
  market: MarketCode | ''
}

const emptyForm: AccessForm = {
  name: '',
  email: '',
  phone: '',
  role: 'operator',
  market: '',
}

function inviteNeedsResend(item: UserItem) {
  return item.inviteMailStatus === 'failed' || item.inviteExpired || (item.status === 'pending' && isStaffAccount(item.roles))
}

const PER_PAGE_OPTIONS = [10, 20, 50, 100]

export function UsersPage() {
  const { token, user, hasPermission } = useAuth()
  const [data, setData] = useState<UsersResponse | null>(null)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [query, setQuery] = useState('')
  const [includeDeleted, setIncludeDeleted] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [form, setForm] = useState<AccessForm>(emptyForm)
  const [editing, setEditing] = useState<UserItem | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const canWriteStatus = hasPermission('users.status.write')
  const canManageAccess = hasPermission('users.access.write')
  const showActions = canWriteStatus || canManageAccess

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
    setEditing(null)
    setForm(emptyForm)
    setFormError('')
  }

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
    setMessage('')
    setFormError('')
  }

  const openEdit = (item: UserItem) => {
    setEditing(item)
    setForm({
      name: item.profile?.fullName ?? '',
      email: item.email,
      phone: item.profile?.phone ?? '',
      role: primaryRole(item.storedRoles?.length ? item.storedRoles : item.roles),
      market: item.markets?.includes('US') && !item.markets.includes('BR') ? 'US' : item.markets?.includes('BR') ? 'BR' : '',
    })
    setDialogOpen(true)
    setMessage('')
    setFormError('')
  }

  const saveAccess = async () => {
    if (!token || !canManageAccess) return
    const email = form.email.trim().toLowerCase()
    if (!editing && !email) {
      setFormError('Informe um e-mail válido.')
      return
    }
    if (!form.name.trim()) {
      setFormError('Informe o nome.')
      return
    }
    if (staffMarketRequired(form.role) && form.market !== 'BR' && form.market !== 'US') {
      setFormError('Informe o mercado.')
      return
    }

    const accessBody = staffMarketRequired(form.role)
      ? { name: form.name.trim(), phone: form.phone.trim() || undefined, role: form.role, market: form.market }
      : { name: form.name.trim(), phone: form.phone.trim() || undefined, role: form.role }

    setSaving(true)
    try {
      setError('')
      setFormError('')
      if (editing) {
        await apiRequest(`/admin/users/${editing.id}`, {
          token,
          method: 'PATCH',
          body: { ...accessBody, phone: form.phone.trim() || null },
        })
        setMessage(`Acesso de ${editing.email} atualizado.`)
      } else {
        const created = await apiRequest<UserItem>('/admin/users', {
          token,
          method: 'POST',
          body: { ...accessBody, email, phone: form.phone.trim() || undefined },
        })
        setMessage(
          created.inviteMailStatus === 'failed' || created.inviteMailStatus === 'skipped'
            ? `Conta de ${created.email} criada, mas o convite não foi enviado — reenviar.`
            : `Acesso criado para ${created.email}. O convite foi enviado.`,
        )
      }
      closeDialog()
      await load()
    } catch (requestError) {
      setFormError(requestError instanceof Error ? requestError.message : 'Falha ao salvar acesso')
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (item: UserItem) => {
    if (!token) return
    const staff = isStaffAccount(item.roles)
    if (staff && !canManageAccess) return
    if (!staff && !canWriteStatus) return

    const nextStatus = isDeactivatedStatus(item.status) ? 'active' : 'inactive'
    const confirmed = window.confirm(
      nextStatus === 'inactive'
        ? `Desativar a conta de ${item.email}? As sessões ativas serão encerradas.`
        : `Reativar a conta de ${item.email}?`,
    )
    if (!confirmed) return

    try {
      setError('')
      await apiRequest(`/admin/users/${item.id}/status`, {
        token,
        method: 'PATCH',
        body: { status: nextStatus },
      })
      setMessage(nextStatus === 'inactive' ? `Conta de ${item.email} desativada.` : `Conta de ${item.email} reativada.`)
      await load()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao alterar status da conta')
    }
  }

  const resendInvite = async (item: UserItem) => {
    if (!token || !canManageAccess) return
    const confirmed = window.confirm(`Reenviar convite para ${item.email}? A senha temporária anterior deixa de valer.`)
    if (!confirmed) return

    try {
      setError('')
      const result = await apiRequest<UserItem>(`/admin/users/${item.id}/invite`, { token, method: 'POST' })
      setMessage(
        result.inviteMailStatus === 'sent'
          ? `Convite reenviado para ${item.email}.`
          : `Não foi possível enviar o convite para ${item.email} — tente de novo.`,
      )
      await load()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao reenviar convite')
    }
  }

  const deleteAccess = async (item: UserItem) => {
    if (!token || !canManageAccess) return
    const confirmed = window.confirm(`Excluir o acesso de ${item.email}? A conta some da listagem e as sessões são encerradas.`)
    if (!confirmed) return

    try {
      setError('')
      await apiRequest(`/admin/users/${item.id}`, { token, method: 'DELETE' })
      setMessage(`Acesso de ${item.email} excluído.`)
      await load()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao excluir acesso')
    }
  }

  const allowlistLocked = Boolean(editing?.lockedByAllowlist)
  const dialogRole = allowlistLocked ? 'admin' : form.role

  return (
    <PageFrame
      title="Clientes"
      description="Contas da loja e do painel. Busque por e-mail ou nome."
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
                <th>Status</th>
                <th>Papel</th>
                <th>Telefone</th>
                <th>Criado em</th>
                {showActions ? <th><span className="sr-only">Ações</span></th> : null}
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 ? (
                <tr className="users-empty">
                  <td colSpan={showActions ? 6 : 5}>Nenhuma conta encontrada{query ? ` para “${query}”` : ''}.</td>
                </tr>
              ) : null}
              {data.items.map((item) => {
                const staff = isStaffAccount(item.roles)
                const isSelf = user?.userId === item.id
                const deleted = Boolean(item.deletedAt)
                const showCustomerToggle = canWriteStatus
                  && !staff
                  && canToggleCustomerStatus(item.status)
                  && !isSelf
                  && !deleted
                const showStaffToggle = canManageAccess
                  && staff
                  && canToggleCustomerStatus(item.status)
                  && !isSelf
                  && !item.lockedByAllowlist
                  && !deleted
                const showEdit = canManageAccess && !isSelf && !deleted
                const showInvite = canManageAccess && staff && inviteNeedsResend(item) && !isSelf && !deleted
                const showDelete = canManageAccess && !isSelf && !item.lockedByAllowlist && !deleted
                const name = item.profile?.fullName

                return (
                  <tr key={item.id}>
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
                    {showActions ? (
                      <td className="users-cell-actions">
                        <div className="table-actions">
                          {showEdit ? (
                            <button className="ghost-button" type="button" onClick={() => openEdit(item)}>Editar</button>
                          ) : null}
                          {showInvite ? (
                            <button className="ghost-button" type="button" onClick={() => void resendInvite(item)}>Reenviar convite</button>
                          ) : null}
                          {showCustomerToggle || showStaffToggle ? (
                            <button className="ghost-button" type="button" onClick={() => void toggleStatus(item)}>
                              {isDeactivatedStatus(item.status) ? 'Reativar' : 'Desativar'}
                            </button>
                          ) : null}
                          {showDelete ? (
                            <button className="danger-button" type="button" onClick={() => void deleteAccess(item)}>Excluir</button>
                          ) : null}
                          {item.lockedByAllowlist && canManageAccess && !isSelf ? (
                            <span className="muted users-note">Papel fixado por ADMIN_EMAILS</span>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
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
        title={editing ? 'Editar acesso' : 'Novo acesso'}
        description={editing ? 'Nome, telefone e papel. O e-mail não muda depois da criação.' : 'Cria a conta como Pendente, grava o papel e envia o convite com senha temporária.'}
        onClose={closeDialog}
        footer={(
          <>
            <button className="ghost-button" type="button" onClick={closeDialog}>Cancelar</button>
            <button className="primary-button" type="button" onClick={() => void saveAccess()} disabled={saving}>
              {saving ? 'Salvando...' : (editing ? 'Salvar' : 'Criar acesso')}
            </button>
          </>
        )}
      >
        <form className="form-grid" onSubmit={(event) => { event.preventDefault(); void saveAccess() }}>
          <label>
            Nome
            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
          </label>
          <label>
            E-mail
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              disabled={Boolean(editing)}
              required={!editing}
            />
          </label>
          <label>
            Telefone <span className="muted">(opcional)</span>
            <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
          </label>
          <label>
            Papel
            <select
              value={dialogRole}
              onChange={(event) => setForm((current) => ({
                ...current,
                role: event.target.value,
                market: event.target.value === 'admin' ? '' : current.market,
              }))}
              disabled={allowlistLocked}
            >
              {PANEL_ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          {staffMarketRequired(dialogRole) ? (
            <label>
              Mercado
              <select
                value={form.market}
                onChange={(event) => setForm((current) => ({ ...current, market: event.target.value === 'US' ? 'US' : event.target.value === 'BR' ? 'BR' : '' }))}
                disabled={allowlistLocked}
                required
              >
                <option value="">Selecione</option>
                <option value="BR">{MARKET_LABELS.BR}</option>
                <option value="US">{MARKET_LABELS.US}</option>
              </select>
            </label>
          ) : null}
          {formError ? <div className="alert">{formError}</div> : null}
          {allowlistLocked ? (
            <div className="warning">
              Este e-mail está em ADMIN_EMAILS. O papel efetivo permanece Admin e não pode ser rebaixado pela UI.
            </div>
          ) : null}
        </form>
      </Dialog>
    </PageFrame>
  )
}
