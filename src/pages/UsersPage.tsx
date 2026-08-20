import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { Pager } from '../components/Pager'
import { FiltersBar } from '../components/FiltersBar'
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

type UserItem = {
  id: string
  email: string
  status: string
  createdAt: string
  roles?: string[]
  profile: { fullName: string | null; phone: string | null } | null
}

type UsersResponse = {
  total: number
  page: number
  perPage: number
  totalPages: number
  items: UserItem[]
}

export function UsersPage() {
  const { token, user, hasPermission } = useAuth()
  const [data, setData] = useState<UsersResponse | null>(null)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const canWriteStatus = hasPermission('users.status.write')

  const load = async () => {
    if (!token) return
    try {
      setError('')
      const response = await apiRequest<UsersResponse>(`/admin/users${buildQueryString({ page, perPage, q: query || undefined })}`, { token })
      setData(response)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar usuários')
    }
  }

  useEffect(() => {
    void load()
  }, [token, page, perPage, query])

  const toggleStatus = async (item: UserItem) => {
    if (!token || !canWriteStatus) return
    const nextStatus = isDeactivatedStatus(item.status) ? 'active' : 'inactive'
    const confirmed = window.confirm(
      nextStatus === 'inactive'
        ? `Desativar a conta de ${item.email}? O cliente não conseguirá entrar na loja até ser reativado.`
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

  return (
    <PageFrame title="Clientes" description="Lista administrativa com busca por e-mail ou nome.">
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
                {canWriteStatus ? <th>Ações</th> : null}
              </tr>
            </thead>
            <tbody>
              {data?.items.map((item) => {
                const showToggle = canWriteStatus
                  && !isStaffAccount(item.roles)
                  && canToggleCustomerStatus(item.status)
                  && user?.userId !== item.id

                return (
                  <tr key={item.id}>
                    <td><Link className="table-link" to={`/users/${item.id}`}>{item.email}</Link></td>
                    <td><span className={accountStatusBadgeClass(item.status)}>{accountStatusLabel(item.status)}</span></td>
                    <td>{item.roles?.filter((role) => role !== 'customer').join(', ') || 'cliente'}</td>
                    <td>{item.profile?.fullName ?? '-'}</td>
                    <td>{item.profile?.phone ?? '-'}</td>
                    <td>{formatDate(item.createdAt)}</td>
                    {canWriteStatus ? (
                      <td>
                        {showToggle ? (
                          <button
                            className={isDeactivatedStatus(item.status) ? 'ghost-button' : 'danger-button'}
                            type="button"
                            onClick={() => void toggleStatus(item)}
                          >
                            {isDeactivatedStatus(item.status) ? 'Reativar' : 'Desativar'}
                          </button>
                        ) : null}
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
    </PageFrame>
  )
}
