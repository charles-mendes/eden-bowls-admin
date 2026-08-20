import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { Pager } from '../components/Pager'
import { FiltersBar } from '../components/FiltersBar'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest, buildQueryString } from '../lib/api'

type StaffUser = {
  id: string
  email: string
  displayName?: string | null
  profile?: { fullName: string | null } | null
  storedRoles: string[]
  roles: string[]
  lockedByAllowlist: boolean
}

type StaffResponse = {
  total: number
  page: number
  perPage: number
  totalPages: number
  items: StaffUser[]
  bootstrapEmails: string[]
}

type UsersSearchResponse = {
  items: StaffUser[]
}

const ROLE_OPTIONS = [
  { value: 'customer', label: 'Sem acesso ao painel' },
  { value: 'nutritionist', label: 'Nutricionista' },
  { value: 'readonly', label: 'Somente leitura' },
  { value: 'operator', label: 'Operador' },
  { value: 'admin', label: 'Admin' },
] as const

function primaryRole(roles: string[] | undefined) {
  if (!roles || roles.length === 0) return 'customer'
  if (roles.includes('admin')) return 'admin'
  if (roles.includes('operator')) return 'operator'
  if (roles.includes('readonly')) return 'readonly'
  if (roles.includes('nutritionist')) return 'nutritionist'
  return 'customer'
}

function assignedRole(item: Pick<StaffUser, 'storedRoles' | 'roles' | 'lockedByAllowlist'>) {
  if (item.lockedByAllowlist) return primaryRole(item.roles)
  const stored = (item.storedRoles ?? []).filter((role) => role !== 'customer')
  if (stored.length > 0) return primaryRole(stored)
  return primaryRole(item.roles)
}

function roleLabel(role: string) {
  return ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role
}

export function RolesPage() {
  const { token, user, hasPermission } = useAuth()
  const canWrite = hasPermission('users.roles.write')
  const [data, setData] = useState<StaffResponse | null>(null)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [matches, setMatches] = useState<StaffUser[]>([])
  const [selected, setSelected] = useState<StaffUser | null>(null)
  const [role, setRole] = useState('operator')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadStaff = async () => {
    if (!token || !canWrite) return
    try {
      setError('')
      const response = await apiRequest<StaffResponse>(`/admin/users/roles${buildQueryString({ page, perPage: 50, q: query || undefined })}`, { token })
      setData(response)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar papéis')
    }
  }

  useEffect(() => {
    void loadStaff()
  }, [token, canWrite, page, query])

  const findUsers = async (event: FormEvent) => {
    event.preventDefault()
    if (!token) return
    try {
      setError('')
      const response = await apiRequest<UsersSearchResponse>(`/admin/users${buildQueryString({ page: 1, perPage: 10, q: search || undefined })}`, { token })
      setMatches(response.items)
      if (response.items.length === 1) {
        chooseUser(response.items[0])
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha na busca')
    }
  }

  const chooseUser = (item: StaffUser) => {
    setSelected(item)
    setRole(assignedRole(item))
    setMessage('')
  }

  const saveRole = async (nextRole: string) => {
    if (!token || !selected) return
    try {
      setError('')
      const response = await apiRequest<StaffUser>(`/admin/users/${selected.id}/roles`, {
        token,
        method: 'PUT',
        body: { role: nextRole },
      })
      setSelected(response)
      setRole(assignedRole(response))
      setMessage(
        nextRole === 'customer'
          ? `Acesso ao painel removido de ${response.email}.`
          : `Papel atualizado para ${response.email}.`,
      )
      await loadStaff()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao salvar papel')
    }
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    await saveRole(role)
  }

  const canRevokeSelected = Boolean(
    selected
    && selected.id !== user?.userId
    && !selected.lockedByAllowlist
    && assignedRole(selected) !== 'customer',
  )

  if (!canWrite) {
    return (
      <PageFrame title="Papéis" description="Somente admin pode atribuir papéis no painel.">
        <div className="alert">Sua conta não tem permissão para gerenciar papéis.</div>
      </PageFrame>
    )
  }

  return (
    <PageFrame title="Papéis" description="Atribui admin, operator, nutritionist ou readonly. ADMIN_EMAILS continua promovendo admin automaticamente.">
      {error ? <div className="alert">{error}</div> : null}
      {message ? <div className="success">{message}</div> : null}

      <Section title="Atribuir papel" description="Busque qualquer conta existente e grave o papel em _eden_admin_roles.">
        <form className="filters-bar" onSubmit={findUsers}>
          <label>
            E-mail ou nome
            <span className="filter-field">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ops@edenbowls.com" />
              <button className="ghost-button" type="submit">Buscar</button>
            </span>
          </label>
        </form>

        {matches.length > 0 ? (
          <div className="table-shell table-scroll">
            <table>
              <thead>
                <tr>
                  <th>E-mail</th>
                  <th>Papel atual</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {matches.map((item) => (
                  <tr key={item.id}>
                    <td>{item.email}</td>
                    <td>{item.roles?.map(roleLabel).join(' · ') || 'Sem acesso ao painel'}</td>
                    <td>
                      <button className="ghost-button" type="button" onClick={() => chooseUser(item)}>
                        Selecionar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {selected ? (
          <form className="stack" onSubmit={save}>
            <p>
              {selected.email}
              {selected.lockedByAllowlist ? <span className="muted"> · fixado por ADMIN_EMAILS</span> : null}
            </p>
            {selected.lockedByAllowlist ? (
              <div className="warning">
                Este e-mail está em ADMIN_EMAILS. O papel admin continua efetivo mesmo se você gravar outro valor.
              </div>
            ) : null}
            <label>
              Papel
              <select value={role} onChange={(event) => setRole(event.target.value)}>
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <div className="inline-actions">
              <button className="primary-button" type="submit">Salvar papel</button>
              {canRevokeSelected ? (
                <button className="danger-button" type="button" onClick={() => void saveRole('customer')}>
                  Remover acesso
                </button>
              ) : null}
              {selected.id === user?.userId ? <span className="muted">Você não pode remover o próprio acesso.</span> : null}
            </div>
          </form>
        ) : null}
      </Section>

      <Section title="Equipe do painel" description="Contas com papel operacional ou e-mail na allowlist.">
        {data?.bootstrapEmails?.length ? (
          <p className="muted">Bootstrap ADMIN_EMAILS: {data.bootstrapEmails.join(', ')}</p>
        ) : (
          <p className="muted">Nenhum e-mail em ADMIN_EMAILS. O primeiro admin precisa ser gravado aqui ou na variável de ambiente.</p>
        )}
        <FiltersBar>
          <label>
            Filtrar equipe
            <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="e-mail" />
          </label>
        </FiltersBar>
        <div className="table-shell table-scroll">
          <table>
            <thead>
              <tr>
                <th>E-mail</th>
                <th>Nome</th>
                <th>Gravado</th>
                <th>Efetivo</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <button className="table-link" type="button" onClick={() => chooseUser(item)}>{item.email}</button>
                    {' · '}
                    <Link className="table-link" to={`/users/${item.id}`}>perfil</Link>
                  </td>
                  <td>{item.profile?.fullName || item.displayName || '-'}</td>
                  <td>{(item.storedRoles ?? []).map(roleLabel).join(' · ') || '-'}</td>
                  <td>
                    {(item.roles ?? []).map(roleLabel).join(' · ')}
                    {item.lockedByAllowlist ? ' (allowlist)' : ''}
                  </td>
                </tr>
              ))}
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
    </PageFrame>
  )
}
