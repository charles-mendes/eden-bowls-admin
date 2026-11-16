import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PlanSettingsPage } from './PlanSettingsPage'
import { AuthProvider } from '../contexts/AuthContext'
import { operatorWriteUser, readonlyUser } from '../test/fixtures'
import { installAdminFetchMock } from '../test/mockAdminFetch'
import { seedAuth } from '../test/renderPage'

function renderPlan(entry = '/catalog/plan?market=BR') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AuthProvider>
        <Routes>
          <Route path="/catalog/plan" element={<PlanSettingsPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

const planCalls = (calls: ReturnType<typeof installAdminFetchMock>['calls'], method: string) =>
  calls.filter((call) => call.path === '/api/v1/admin/catalog/plan-settings' && call.method === method)

describe('PlanSettingsPage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('Readonly sees the values', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(readonlyUser)
    renderPlan()

    const days = await screen.findByLabelText('Duração (dias)')
    expect(days).toHaveValue(30)
    expect(days).toHaveAttribute('readonly')
    expect(screen.getByLabelText('Limite do pacote pequeno')).toHaveValue(8)
    expect(screen.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument()
    expect(planCalls(calls, 'GET')[0].search).toBe('?market=BR')
  })

  it('Save the limit', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderPlan()

    const limit = await screen.findByLabelText('Limite do pacote pequeno')
    await user.clear(limit)
    await user.type(limit, '6')
    expect(screen.getByText('Plano alterado. Salve antes de sair.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('Plano salvo.')).toBeInTheDocument()
    const [put] = planCalls(calls, 'PUT')
    expect(put.search).toBe('?market=BR')
    expect(put.body).toEqual({ planDays: 30, largePackLimit: 6 })
    expect(screen.getByLabelText('Limite do pacote pequeno')).toHaveValue(6)
    expect(screen.queryByText('Plano alterado. Salve antes de sair.')).not.toBeInTheDocument()
  })

  it('Limit out of range', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderPlan()

    const limit = await screen.findByLabelText('Limite do pacote pequeno')
    await user.clear(limit)
    await user.type(limit, '0')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(limit).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Informe um número inteiro de 1 a 60.')).toBeInTheDocument()
    expect(planCalls(calls, 'PUT')).toHaveLength(0)
  })

  it('Decimal plan days', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderPlan()

    const days = await screen.findByLabelText('Duração (dias)')
    await user.clear(days)
    await user.type(days, '28.5')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(days).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Informe um número inteiro de dias, maior que zero.')).toBeInTheDocument()
    expect(planCalls(calls, 'PUT')).toHaveLength(0)
  })

  it('shows the API refusal on its field and keeps the typed value', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(operatorWriteUser, {
      routes: ({ path, method }) => (path === '/api/v1/admin/catalog/plan-settings' && method === 'PUT'
        ? new Response(JSON.stringify({ message: 'Plan days must be a whole number greater than zero.', details: { code: 'plan_days_invalid' } }), { status: 422, headers: { 'Content-Type': 'application/json' } })
        : undefined),
    })
    renderPlan()

    const days = await screen.findByLabelText('Duração (dias)')
    await user.clear(days)
    await user.type(days, '29')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('A API recusou a duração: use um número inteiro maior que zero.')).toBeInTheDocument()
    expect(days).toHaveValue(29)
  })
})
