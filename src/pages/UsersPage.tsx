import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { Pager } from '../components/Pager'
import { FiltersBar } from '../components/FiltersBar'
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
}

const emptyForm: AccessForm = {
  name: '',
  email: '',
  phone: '',
  role: 'operator',
}

function inviteNeedsResend(item: UserItem) {
  return item.inviteMailStatus === 'failed' || item.inviteExpired || (item.status === 'pending' && isStaffAccount(item.roles))
}

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
  }

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
    setMessage('')
  }

  const openEdit = (item: UserItem) => {
    setEditing(item)
    setForm({
      name: item.profile?.fullName ?? '',
      email: item.email,
      phone: item.profile?.phone ?? '',
      role: primaryRole(item.storedRoles?.length ? item.storedRoles : item.roles),
    })
    setDialogOpen(true)
    setMessage('')
  }

  const saveAccess = async () => {
    if (!token || !canManageAccess) return
    const email = form.email.trim().toLowerCase()
    if (!editing && !email) {
      setError('Informe um e-mail válido.')
      return
    }
    if (!form.name.trim()) {
      setError('Informe o nome.')
      return
    }

    setSaving(true)
    try {
      setError('')
      if (editing) {
        await apiRequest(`/admin/users/${editing.id}`, {
          token,
          method: 'PATCH',
          body: { name: form.name.trim(), phone: form.phone.trim() || null, role: form.role },
        })
        setMessage(`Acesso de ${editing.email} atualizado.`)
      } else {
        const created = await apiRequest<UserItem>('/admin/users', {
          token,
          method: 'POST',
          body: { name: form.name.trim(), email, phone: form.phone.trim() || undefined, role: form.role },
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
      setError(requestError instanceof Error ? requestError.message : 'Falha ao salvar acesso')
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
      description="Lista administrativa com busca por e-mail ou nome. Admin também cria e gerencia acessos do painel."
      actions={canManageAccess ? (
        <button className="primary-button" type="button" onClick={openCreate}>
          Novo acesso
        </button>
      ) : null}
    >
      <Section title="Filtros" description="Paginação unificada em page/perPage.">
        <FiltersBar>
          <label>
            Busca
            <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="e-mail ou nome" />
          </label>
          <label>
            Por página
            <input type="number" min={1} max={100} value={perPage} onChange={(event) => { setPerPage(Number(event.target.value)); setPage(1) }} />
          </label>
          {canManageAccess ? (
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={includeDeleted}
                onChange={(event) => { setIncludeDeleted(event.target.checked); setPage(1) }}
              />
              Incluir excluídos
            </label>
          ) : null}
        </FiltersBar>

        {error ? <div className="alert">{error}</div> : null}
        {message ? <div className="success">{message}</div> : null}

        <div className="table-shell table-scroll">
          <table>
            <thead>
              <tr>
                <th>E-mail</th>
                <th>Status</th>
                <th>Papel</th>
                <th>Nome</th>
                <th>Telefone</th>
                <th>Criado em</th>
                {showActions ? <th>Ações</th> : null}
              </tr>
            </thead>
            <tbody>
              {data?.items.map((item) => {
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

                return (
                  <tr key={item.id}>
                    <td>
                      <Link className="table-link" to={`/users/${item.id}`}>{item.email}</Link>
                      {item.inviteMailStatus === 'failed' ? (
                        <div className="muted">Convite não enviado — reenviar</div>
                      ) : null}
                    </td>
                    <td>
                      <span className={accountStatusBadgeClass(deleted ? 'deleted' : item.status)}>
                        {accountStatusLabel(deleted ? 'deleted' : item.status)}
                      </span>
                    </td>
                    <td>
                      {item.roles?.filter((role) => role !== 'customer').map(roleLabel).join(', ') || 'cliente'}
                      {item.lockedByAllowlist ? <div className="muted">Efetivo: {roleLabel(primaryRole(item.roles))} (allowlist)</div> : null}
                    </td>
                    <td>{item.profile?.fullName ?? '-'}</td>
                    <td>{item.profile?.phone ?? '-'}</td>
                    <td>{formatDate(item.createdAt)}</td>
                    {showActions ? (
                      <td>
                        <div className="table-actions">
                          {showEdit ? (
                            <button className="ghost-button" type="button" onClick={() => openEdit(item)}>Editar</button>
                          ) : null}
                          {showInvite ? (
                            <button className="ghost-button" type="button" onClick={() => void resendInvite(item)}>Reenviar convite</button>
                          ) : null}
                          {showCustomerToggle || showStaffToggle ? (
                            <button
                              className={isDeactivatedStatus(item.status) ? 'ghost-button' : 'danger-button'}
                              type="button"
                              onClick={() => void toggleStatus(item)}
                            >
                              {isDeactivatedStatus(item.status) ? 'Reativar' : 'Desativar'}
                            </button>
                          ) : null}
                          {showDelete ? (
                            <button className="danger-button" type="button" onClick={() => void deleteAccess(item)}>Excluir</button>
                          ) : null}
                          {isSelf ? <span className="muted">Sua conta</span> : null}
                          {item.lockedByAllowlist && canManageAccess && !isSelf ? (
                            <span className="muted">Papel efetivo fixado por ADMIN_EMAILS</span>
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
          page={data?.page ?? page}
          totalPages={data?.totalPages ?? 1}
          onPrev={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => current + 1)}
        />
      </Section>

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
              onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
              disabled={allowlistLocked}
            >
              {PANEL_ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
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
