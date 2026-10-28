import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SettingsPage } from './SettingsPage'
import type { AdminUser } from '../contexts/AuthContext'
import { adminUser, jsonResponse, operatorWriteUser } from '../test/fixtures'
import { findCall, installAdminFetchMock, type FetchCall } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

const admin: AdminUser = {
  ...adminUser,
  permissions: [...adminUser.permissions, 'settings.read', 'settings.company.write', 'legal.write', 'settings.email.write'],
}
const operator: AdminUser = { ...operatorWriteUser, permissions: [...operatorWriteUser.permissions, 'settings.read', 'settings.email.write'] }

function company(market: string) {
  return {
    market,
    legal_name: market === 'BR' ? 'C. C. J. Lovato Ltda' : 'EZER ONE INC (Eden Bowls)',
    tax_id: market === 'BR' ? '65.291.985/0001-05' : '',
    street: 'Rua Delmiro Fetter dos Santos, 94',
    complement: 'Cajuru',
    city: 'Curitiba',
    state: 'PR',
    postal_code: '82950-130',
    country: 'BR',
    support_email: 'hello@edenbowls.com',
    store_url: 'https://edenbowls.com',
    updated_at: null,
  }
}

function routes(respond?: (call: FetchCall) => Response | undefined) {
  const versions = [{ version: '2026-01-15', published_at: '2026-01-15T12:00:00.000Z', published_by: 1 }]
  let current = { version: '2026-01-15', published_at: '2026-01-15T12:00:00.000Z', body_markdown: '# Termos\n\nTexto antigo.' }
  return (call: FetchCall) => {
    const custom = respond?.(call)
    if (custom) return custom
    const market = new URLSearchParams(call.search).get('market') || (call.body as { market?: string } | null)?.market || 'BR'
    if (call.path === '/api/v1/admin/settings/company' && call.method === 'GET') return jsonResponse(company(market))
    if (call.path === '/api/v1/admin/settings/company' && call.method === 'PUT') return jsonResponse({ market, ...(call.body as { profile: object }).profile })
    if (call.path === '/api/v1/admin/legal/terms' && call.method === 'GET') {
      return jsonResponse({ market, kind: 'terms', current: { market, kind: 'terms', ...current }, versions })
    }
    if (call.path === '/api/v1/admin/legal/terms' && call.method === 'POST') {
      const body = call.body as { version: string; body_markdown: string }
      current = { version: body.version, published_at: '2026-11-01T12:00:00.000Z', body_markdown: body.body_markdown }
      versions.unshift({ version: body.version, published_at: current.published_at, published_by: 1 })
      return jsonResponse({ market, kind: 'terms', current: { market, kind: 'terms', ...current }, versions })
    }
    if (call.path === '/api/v1/admin/settings/automated-emails' && call.method === 'GET') {
      return jsonResponse({ market, life_stage_change_enabled: true, announcement_batch_size: 50, announcement_daily_cap: 200, updated_at: null })
    }
    return undefined
  }
}

function renderPage(profile: AdminUser, route: string, respond?: (call: FetchCall) => Response | undefined) {
  seedAuth()
  const mock = installAdminFetchMock(profile, { routes: routes(respond) })
  renderAuthedPage(<SettingsPage />, route, '/config')
  return mock
}

describe('SettingsPage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('Operator reads but cannot save the BR company profile', async () => {
    renderPage(operator, '/config')

    expect(await screen.findByLabelText('CNPJ')).toHaveValue('65.291.985/0001-05')
    expect(screen.getByLabelText('CNPJ')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Salvar empresa' })).not.toBeInTheDocument()
  })

  it('Invalid CNPJ: marks the field the API lists', async () => {
    const user = userEvent.setup()
    const { calls } = renderPage(admin, '/config?mercado=br', (call) => (call.method === 'PUT' && call.path === '/api/v1/admin/settings/company'
      ? jsonResponse({ success: false, message: 'Invalid', details: { code: 'company_profile_invalid', fields: ['tax_id'] } }, 422)
      : undefined))

    const cnpj = await screen.findByLabelText('CNPJ')
    await user.clear(cnpj)
    await user.type(cnpj, '11.111.111/1111-11')
    await user.click(screen.getByRole('button', { name: 'Salvar empresa' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Dados da empresa inválidos: CNPJ.')
    expect(screen.getByLabelText('CNPJ')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Cidade')).not.toHaveAttribute('aria-invalid')
    const body = findCall(calls, 'PUT', '/api/v1/admin/settings/company')?.body as { market: string; profile: { tax_id: string } }
    expect(body.market).toBe('BR')
    expect(body.profile.tax_id).toBe('11.111.111/1111-11')
  })

  it('Publish new terms: sends the market, version and body, then shows it as current', async () => {
    const user = userEvent.setup()
    const { calls } = renderPage(admin, '/config?aba=legal&mercado=us&documento=terms')

    const version = await screen.findByLabelText('Versão (AAAA-MM-DD)')
    await user.clear(version)
    await user.type(version, '2026-11-01')
    const text = screen.getByLabelText('Texto (Markdown)')
    await user.clear(text)
    await user.type(text, '# Terms of use')
    await user.click(screen.getByRole('button', { name: 'Publicar versão' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Publicar termos de uso' })).getByRole('button', { name: 'Confirmar publicação' }))

    expect(await screen.findByText(/Versão atual 2026-11-01/)).toBeInTheDocument()
    expect(findCall(calls, 'POST', '/api/v1/admin/legal/terms')?.body).toEqual({ market: 'US', version: '2026-11-01', body_markdown: '# Terms of use' })
  })

  it('Version id already used: says so and keeps the typed text', async () => {
    const user = userEvent.setup()
    renderPage(admin, '/config?aba=legal&documento=terms', (call) => (call.method === 'POST' && call.path === '/api/v1/admin/legal/terms'
      ? jsonResponse({ success: false, message: 'Taken', details: { code: 'legal_version_taken' } }, 409)
      : undefined))

    const text = await screen.findByLabelText('Texto (Markdown)')
    await user.type(text, '\nNova cláusula.')
    await user.click(screen.getByRole('button', { name: 'Publicar versão' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirmar publicação' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Essa versão já existe. Escolha outra data.')
    expect(screen.getByLabelText('Texto (Markdown)')).toHaveValue('# Termos\n\nTexto antigo.\nNova cláusula.')
  })

  it('Cap lower than batch: marks the cap and sends nothing', async () => {
    const user = userEvent.setup()
    const { calls } = renderPage(operator, '/config?aba=emails')

    const batch = await screen.findByLabelText('Lote por execução')
    await user.clear(batch)
    await user.type(batch, '100')
    const cap = screen.getByLabelText('Limite diário')
    await user.clear(cap)
    await user.type(cap, '50')
    await user.click(screen.getByRole('button', { name: 'Salvar e-mails' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('O limite diário não pode ser menor que o lote por execução.')
    expect(screen.getByLabelText('Limite diário')).toHaveAttribute('aria-invalid', 'true')
    expect(calls.some((call) => call.method === 'PUT' && call.path === '/api/v1/admin/settings/automated-emails')).toBe(false)
  })
})
