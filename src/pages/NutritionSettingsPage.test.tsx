import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NutritionSettingsPage } from './NutritionSettingsPage'
import type { AdminUser } from '../contexts/AuthContext'
import { jsonResponse, operatorWriteUser, veterinarianUser } from '../test/fixtures'
import { findCall, installAdminFetchMock, type FetchCall } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

// The veterinarian with the new permission and no assigned market: the API accepts both markets.
const veterinarian: AdminUser = { ...veterinarianUser, markets: [], permissions: ['nutrition.simulate', 'nutrition.settings.write'] }

const PARAMETERS = {
  combination: { 'SIM-BAIXO-ADEQUADO': 85, 'NAO-ALTO-ACIMA': 85 },
  state: { SENIOR: 95, GESTANTE: 132 },
  base: { dog: 95, cat: 242 },
  nem: { dog: 3600, cat: 3800 },
  breed_groups: { dogue: ['dogue alemao', 'great dane'], slow_metabolism: ['sao bernardo'], terranova: ['terra nova'] },
}

type Server = {
  preview?: { pets_evaluated: number; pets_changing: number; transitions: Array<{ from: string; to: string; count: number }> }
  respond?: (call: FetchCall) => Response | undefined
}

function lifeStage(market: string) {
  return {
    market,
    sizeClasses: [
      { sizeClass: 'small', adultFromMonths: 10, seniorFromMonths: 120, updatedBy: null, updatedAt: null },
      { sizeClass: 'medium', adultFromMonths: 12, seniorFromMonths: 96, updatedBy: null, updatedAt: null },
      { sizeClass: 'large', adultFromMonths: 15, seniorFromMonths: 84, updatedBy: null, updatedAt: null },
      { sizeClass: 'giant', adultFromMonths: 18, seniorFromMonths: 72, updatedBy: null, updatedAt: null },
    ],
    breeds: [
      { id: 4, market, namePt: 'Dogue Alemão', nameEn: 'Great Dane', sizeClass: 'giant', active: true, updatedBy: null, updatedAt: null },
    ],
  }
}

function routes(server: Server = {}) {
  let draft: { id: number; status: string; parameters: typeof PARAMETERS } | null = null
  let published = { id: 1, parameters: PARAMETERS, publishedAt: '2026-10-27T10:00:00.000Z' }
  const breeds: unknown[] = []
  return (call: FetchCall) => {
    const custom = server.respond?.(call)
    if (custom) return custom
    const market = new URLSearchParams(call.search).get('market') || (call.body as { market?: string } | null)?.market || 'BR'
    if (call.path === '/api/v1/admin/life-stage' && call.method === 'GET') {
      const overview = lifeStage(market)
      return jsonResponse({ ...overview, breeds: [...overview.breeds, ...breeds] })
    }
    if (call.path === '/api/v1/admin/life-stage/preview') {
      return jsonResponse({ market, ...(server.preview ?? { pets_evaluated: 10, pets_changing: 0, transitions: [] }) })
    }
    if (call.path === '/api/v1/admin/life-stage/limits' && call.method === 'PUT') return jsonResponse(lifeStage(market))
    if (call.path === '/api/v1/admin/life-stage/breeds' && call.method === 'POST') {
      const body = call.body as { name_pt: string; name_en: string; size_class: string }
      const breed = { id: 9, market, namePt: body.name_pt, nameEn: body.name_en, sizeClass: body.size_class, active: true, updatedBy: 5, updatedAt: null }
      breeds.push(breed)
      return jsonResponse(breed)
    }
    if (call.path === '/api/v1/admin/nutrition/parameters' && call.method === 'GET') {
      return jsonResponse({ published, draft, history: [{ id: published.id, status: 'published', publishedAt: published.publishedAt }, { id: 0, status: 'retired', publishedAt: '2026-09-01T10:00:00.000Z' }] })
    }
    if (call.path === '/api/v1/admin/nutrition/parameters/draft' && call.method === 'PUT') {
      draft = { id: 2, status: 'draft', parameters: (call.body as { parameters: typeof PARAMETERS }).parameters }
      return jsonResponse(draft)
    }
    if (call.path === '/api/v1/admin/nutrition/parameters/publish' && call.method === 'POST') {
      published = { id: 2, parameters: draft!.parameters, publishedAt: '2026-10-28T10:00:00.000Z' }
      draft = null
      return jsonResponse(published)
    }
    return undefined
  }
}

function renderPage(profile: AdminUser, server: Server = {}, route = '/nutrition/settings') {
  seedAuth()
  const mock = installAdminFetchMock(profile, { routes: routes(server) })
  renderAuthedPage(<NutritionSettingsPage />, route, '/nutrition/settings')
  return mock
}

describe('NutritionSettingsPage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('Operator reads only: shows the BR limits without a save button', async () => {
    renderPage(operatorWriteUser)

    expect(await screen.findByLabelText('Médio: sênior a partir de')).toHaveValue(96)
    expect(screen.getByLabelText('Médio: sênior a partir de')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Salvar limites' })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Mercado' })).not.toBeInTheDocument()
  })

  it('Preview before lowering the senior age: saves only after the confirmation', async () => {
    const user = userEvent.setup()
    const { calls } = renderPage(veterinarian, { preview: { pets_evaluated: 40, pets_changing: 3, transitions: [{ from: 'adult', to: 'senior', count: 3 }] } })

    expect(await screen.findByRole('group', { name: 'Mercado' })).toBeInTheDocument()
    const senior = await screen.findByLabelText('Médio: sênior a partir de')
    await user.clear(senior)
    await user.type(senior, '84')
    await user.click(screen.getByRole('button', { name: 'Salvar limites' }))

    const dialog = await screen.findByRole('dialog', { name: 'Salvar limites' })
    expect(within(dialog).getByText('3 de 40 pets mudariam de fase em Brasil:')).toBeInTheDocument()
    expect(within(dialog).getByText('adulto → sênior: 3')).toBeInTheDocument()
    expect(findCall(calls, 'POST', '/api/v1/admin/life-stage/preview')?.body).toEqual({ market: 'BR', limits: { medium: { adult_from_months: 12, senior_from_months: 84 } } })
    expect(calls.some((call) => call.method === 'PUT' && call.path === '/api/v1/admin/life-stage/limits')).toBe(false)

    await user.click(within(dialog).getByRole('button', { name: 'Confirmar' }))

    expect(await screen.findByText('Limites de Brasil salvos.')).toBeInTheDocument()
    expect(findCall(calls, 'PUT', '/api/v1/admin/life-stage/limits')?.body).toEqual({ market: 'BR', limits: { medium: { adult_from_months: 12, senior_from_months: 84 } } })
  })

  it('Invalid limits: marks the field the API lists', async () => {
    const user = userEvent.setup()
    renderPage(veterinarian, {
      respond: (call) => (call.path === '/api/v1/admin/life-stage/preview'
        ? jsonResponse({ success: false, message: 'Invalid', details: { code: 'life_stage_limits_invalid', fields: ['small.senior_from_months'] } }, 422)
        : undefined),
    })

    const senior = await screen.findByLabelText('Pequeno: sênior a partir de')
    await user.clear(senior)
    await user.type(senior, '100')
    const adult = screen.getByLabelText('Pequeno: adulto a partir de')
    await user.clear(adult)
    await user.type(adult, '120')
    await user.click(screen.getByRole('button', { name: 'Salvar limites' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Pequeno: sênior a partir de')
    expect(screen.getByLabelText('Pequeno: sênior a partir de')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Pequeno: adulto a partir de')).not.toHaveAttribute('aria-invalid')
  })

  it('Add a giant breed: no pet changes, so it is saved at once and listed', async () => {
    const user = userEvent.setup()
    const { calls } = renderPage(veterinarian, {}, '/nutrition/settings?aba=racas&mercado=us')

    expect(await screen.findByText('Great Dane')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Nome em português'), 'Mastim Napolitano')
    await user.type(screen.getByLabelText('Nome em inglês'), 'Neapolitan Mastiff')
    await user.click(screen.getByRole('button', { name: 'Incluir raça' }))

    expect(await screen.findByText('Neapolitan Mastiff')).toBeInTheDocument()
    expect(findCall(calls, 'POST', '/api/v1/admin/life-stage/breeds')?.body).toEqual({
      market: 'US', name_pt: 'Mastim Napolitano', name_en: 'Neapolitan Mastiff', size_class: 'giant',
    })
  })

  it('Publish a changed factor: saves the whole draft, then publishes after confirming', async () => {
    const user = userEvent.setup()
    const { calls } = renderPage(veterinarian, {}, '/nutrition/settings?aba=fatores')

    const senior = await screen.findByLabelText('Sênior')
    await user.clear(senior)
    await user.type(senior, '90')
    await user.click(screen.getByRole('button', { name: 'Salvar rascunho' }))

    expect(await screen.findByText(/Rascunho salvo/)).toBeInTheDocument()
    const saved = findCall(calls, 'PUT', '/api/v1/admin/nutrition/parameters/draft')?.body as { parameters: typeof PARAMETERS }
    expect(saved.parameters).toEqual({ ...PARAMETERS, state: { ...PARAMETERS.state, SENIOR: 90 } })

    await user.click(await screen.findByRole('button', { name: 'Publicar' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Publicar conjunto' })).getByRole('button', { name: 'Confirmar publicação' }))

    expect(await screen.findByText(/Conjunto publicado/)).toBeInTheDocument()
    expect(findCall(calls, 'POST', '/api/v1/admin/nutrition/parameters/publish')).toBeTruthy()
    await waitFor(() => expect(screen.getByLabelText('Sênior')).toHaveValue(90))
  })

  it('shows the published factors read-only to an operator', async () => {
    renderPage(operatorWriteUser, {}, '/nutrition/settings?aba=fatores')
    expect(await screen.findByLabelText('Sênior')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Salvar rascunho' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Copiar para rascunho' })).not.toBeInTheDocument()
  })
})
