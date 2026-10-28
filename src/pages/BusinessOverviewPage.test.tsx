import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render } from '@testing-library/react'
import { AuthProvider } from '../contexts/AuthContext'
import { adminUser, operatorUser } from '../test/fixtures'
import { installAdminFetchMock } from '../test/mockAdminFetch'
import { seedAuth } from '../test/renderPage'
import { InsightsRoute } from './BusinessOverviewPage'

function renderInsights(route: string, user = operatorUser) {
  seedAuth()
  const mock = installAdminFetchMock(user)
  render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <Routes>
          <Route path="/insights" element={<InsightsRoute />} />
          <Route path="/dashboard" element={<div>hoje-page</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
  return mock
}

describe('BusinessOverviewPage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('hides demonstration numbers when the demo flag is off', async () => {
    renderInsights('/insights?fase2=1')

    await waitFor(() => {
      expect(screen.getByText('hoje-page')).toBeInTheDocument()
    })
    expect(screen.queryByText('Dados de demonstração')).not.toBeInTheDocument()
    expect(screen.queryByText('R$ 241.390')).not.toBeInTheDocument()
    expect(screen.queryByText('Fase 2')).not.toBeInTheDocument()
  })

  it('shows the prototype sections from the fixture without calling apiRequest for the metrics', async () => {
    vi.stubEnv('VITE_DEMO_INSIGHTS', 'true')
    const user = userEvent.setup()
    const { calls } = renderInsights('/insights', adminUser)

    expect(await screen.findByText('Dados de demonstração')).toBeInTheDocument()
    const headings = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)
    expect(headings).toEqual(['Receita', 'Assinaturas', 'Tendência semanal', 'Funil de aquisição', 'Mix das próximas entregas'])
    expect(screen.getByText('Hoje na operação').closest('a')).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('link', { name: 'Ver assinantes →' })).toHaveAttribute('href', '/billing')
    expect(screen.getByRole('link', { name: 'Ver checkouts →' })).toHaveAttribute('href', '/onboarding/sessions')
    expect(screen.getByText(/de Brasil nos últimos 30 dias/)).toBeInTheDocument()
    expect(screen.getByText(/de Brasil nos últimos 30 dias/).textContent).not.toMatch(/\d{1,2}:\d{2}/)
    expect(screen.getByText('R$ 241.390')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Todos' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Brasil' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'EUA' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /693 novas assinaturas e 104 cancelamentos nas últimas 8 semanas/ })).toBeInTheDocument()
    expect(screen.getByTitle('Semana 36: 72 novas, 14 cancelamentos')).toBeInTheDocument()
    expect(screen.getAllByText(/converteram/)).toHaveLength(2)
    expect(screen.queryByText('Fase 2')).not.toBeInTheDocument()

    const billing = screen.getByText('Faturamento no período').parentElement?.querySelector('strong')?.textContent
    await user.click(screen.getByRole('button', { name: '7 dias' }))
    expect(screen.getByText(/últimas 8 semanas/)).toBeInTheDocument()
    expect(screen.getByText('R$ 241.390')).toBeInTheDocument()
    expect(screen.getByText('Faturamento no período').parentElement?.querySelector('strong')?.textContent).not.toBe(billing)
    expect(calls.some((call) => call.path.includes('insights'))).toBe(false)

    await user.click(screen.getByRole('button', { name: 'EUA' }))
    expect(screen.getByText(/de EUA nos últimos 7 dias/)).toBeInTheDocument()
    expect(screen.getByText('Chicken curry')).toBeInTheDocument()
  })

  it('omits the market control for a single-market operator and names that market', async () => {
    vi.stubEnv('VITE_DEMO_INSIGHTS', 'true')
    renderInsights('/insights')

    expect(await screen.findByText(/de Brasil nos últimos 30 dias/)).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Mercado' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'EUA' })).not.toBeInTheDocument()
    expect(screen.getByText('Frango ao curry')).toBeInTheDocument()
  })

  it('shows Phase 2 badges only for the walkthrough query', async () => {
    vi.stubEnv('VITE_DEMO_INSIGHTS', 'true')
    renderInsights('/insights?fase2=1')

    expect(await screen.findByText('R$ 241.390')).toBeInTheDocument()
    const badges = screen.getAllByText('Fase 2')
    expect(badges).toHaveLength(3)
    expect(screen.getByRole('heading', { name: 'Receita' }).parentElement).toContainElement(badges[0])
    expect(screen.getByRole('heading', { name: 'Tendência semanal' }).closest('section')).toContainElement(badges[1])
    expect(screen.getByRole('heading', { name: 'Mix das próximas entregas' }).closest('section')).toContainElement(badges[2])
  })
})
