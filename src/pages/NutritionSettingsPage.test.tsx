import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NutritionSettingsPage } from './NutritionSettingsPage'
import type { AdminUser } from '../contexts/AuthContext'
import { adminUser, jsonResponse, operatorUsWriteUser, operatorWriteUser, veterinarianUser } from '../test/fixtures'
import { findCall, installAdminFetchMock, type FetchCall } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

// The veterinarian with the permissions the API gives the role and no assigned market: the API accepts both markets.
const veterinarian: AdminUser = { ...veterinarianUser, markets: [], permissions: ['nutrition.simulate', 'nutrition.settings.write', 'nutrition.breeds.write', 'nutrition.limits.write'] }
// The admin writes factors and breeds, but not the life-stage limits.
const admin: AdminUser = { ...adminUser, permissions: [...adminUser.permissions, 'nutrition.simulate', 'nutrition.settings.write', 'nutrition.breeds.write'] }

// The operator of one market with the breed permission the API gives the role.
const operatorBr: AdminUser = { ...operatorWriteUser, permissions: [...operatorWriteUser.permissions, 'nutrition.breeds.write'] }
const operatorUs: AdminUser = { ...operatorUsWriteUser, permissions: [...operatorUsWriteUser.permissions, 'nutrition.breeds.write'] }

const BREED_HISTORY = [
  { id: 12, action: 'life_stage.breed.update', actorUserId: 9, actorEmail: 'ana.souza@edenbowls.com', createdAt: '2026-11-13T09:10:00.000Z', metadata: { market: 'BR', breed_id: 7, before: null, after: { namePt: 'Mastim Tibetano', nameEn: 'Tibetan Mastiff', sizeClass: 'giant', active: true } } },
  { id: 11, action: 'life_stage.breed.update', actorUserId: 9, actorEmail: 'ana.souza@edenbowls.com', createdAt: '2026-11-12T13:20:00.000Z', metadata: { market: 'BR', breed_id: 4, before: { namePt: 'Dogue Alemão', nameEn: 'Great Dane', sizeClass: 'large', active: true }, after: { namePt: 'Dogue Alemão', nameEn: 'Great Dane', sizeClass: 'giant', active: true } } },
  { id: 10, action: 'life_stage.limits.update', actorUserId: 5, actorEmail: 'vet@edenbowls.com', createdAt: '2026-11-10T14:00:00.000Z', metadata: { market: 'BR', before: { small: { adultFromMonths: 9, seniorFromMonths: 120 } }, after: { small: { adultFromMonths: 10, seniorFromMonths: 120 } } } },
]

const PARAMETERS = {
  combination: { 'SIM-BAIXO-ADEQUADO': 85, 'NAO-ALTO-ACIMA': 85 },
  combination_giant: { 'SIM-BAIXO-ADEQUADO': 85, 'NAO-ALTO-ABAIXO': 115 },
  state: { SENIOR: 95, GESTANTE: 132 },
  base: { cat: 60, cat_active: 100 },
  nem: { dog: 1200, cat: 1200 },
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
      return jsonResponse({ ...overview, breeds: [...overview.breeds, ...breeds], history: BREED_HISTORY.map((event) => ({ ...event, metadata: { ...event.metadata, market } })) })
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
      return jsonResponse({ published, draft, audit: [{ id: 20, action: 'nutrition.parameters.draft.save', actorUserId: 5, actorEmail: 'vet@edenbowls.com', createdAt: '2026-10-26T16:30:00.000Z', metadata: { set_id: 3, changes: [{ field: 'state.SENIOR', from: 90, to: 95 }] } }], history: [{ id: published.id, status: 'published', publishedAt: published.publishedAt }, { id: 0, status: 'retired', publishedAt: '2026-09-01T10:00:00.000Z' }] })
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

function renderPage(profile: AdminUser, server: Server = {}, route = '/nutrition/settings?aba=fases') {
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
    expect(screen.queryByLabelText('Nome em português')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Incluir raça' }))
    const dialog = await screen.findByRole('dialog', { name: 'Incluir raça em Estados Unidos' })
    await user.type(within(dialog).getByLabelText('Nome em português'), 'Mastim Napolitano')
    await user.type(within(dialog).getByLabelText('Nome em inglês'), 'Neapolitan Mastiff')
    await user.click(within(dialog).getByRole('button', { name: 'Incluir raça' }))

    expect(await screen.findByText('Neapolitan Mastiff')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Mastim Napolitano incluída.')).toBeInTheDocument()
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

  it('the BR operator edits and adds breeds of Brasil but not the limits', async () => {
    const user = userEvent.setup()
    const { calls } = renderPage(operatorBr, {}, '/nutrition/settings?aba=racas')

    expect(await screen.findByText(/Você pode incluir e editar raças de Brasil/)).toBeInTheDocument()
    await user.selectOptions(await screen.findByLabelText('Porte de Dogue Alemão'), 'large')
    await waitFor(() => expect(findCall(calls, 'PATCH', '/api/v1/admin/life-stage/breeds/4')?.body).toEqual({ market: 'BR', size_class: 'large' }))
    expect(findCall(calls, 'POST', '/api/v1/admin/life-stage/preview')?.body).toEqual({ market: 'BR', breed: { id: 4, size_class: 'large' } })

    await user.click(screen.getByRole('button', { name: 'Incluir raça' }))
    const dialog = await screen.findByRole('dialog', { name: 'Incluir raça em Brasil' })
    await user.type(within(dialog).getByLabelText('Nome em português'), 'Mastim Napolitano')
    await user.type(within(dialog).getByLabelText('Nome em inglês'), 'Neapolitan Mastiff')
    await user.click(within(dialog).getByRole('button', { name: 'Incluir raça' }))
    await waitFor(() => expect(findCall(calls, 'POST', '/api/v1/admin/life-stage/breeds')?.body).toMatchObject({ market: 'BR', name_pt: 'Mastim Napolitano' }))

    await user.click(screen.getByRole('tab', { name: 'Fases da vida' }))
    expect(await screen.findByLabelText('Médio: sênior a partir de')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Salvar limites' })).not.toBeInTheDocument()
  })

  it('the US operator sees only Estados Unidos and writes its breeds', async () => {
    const { calls } = renderPage(operatorUs, {}, '/nutrition/settings?aba=racas&mercado=br')
    expect(await screen.findByText('Raças com porte próprio em Estados Unidos')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Mercado' })).not.toBeInTheDocument()
    expect(await screen.findByLabelText('Porte de Dogue Alemão')).toBeEnabled()
    expect(calls.every((call) => call.path !== '/api/v1/admin/life-stage' || call.search.includes('market=US'))).toBe(true)
  })

  it('an operator without the breed permission reads breeds only', async () => {
    renderPage(operatorWriteUser, {}, '/nutrition/settings?aba=racas')
    expect(await screen.findByText('Great Dane')).toBeInTheDocument()
    expect(screen.queryByLabelText('Porte de Dogue Alemão')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Incluir raça' })).not.toBeInTheDocument()
  })

  it('shows who edited each tab', async () => {
    const user = userEvent.setup()
    renderPage(veterinarian, {}, '/nutrition/settings?aba=racas')

    const log = await screen.findByRole('list', { name: 'Histórico de edições' })
    expect(within(log).getByText('Incluiu a raça Mastim Tibetano')).toBeInTheDocument()
    expect(within(log).getByText('Porte: Grande → Gigante')).toBeInTheDocument()
    expect(within(log).getAllByText('ana.souza@edenbowls.com')).toHaveLength(2)
    expect(within(log).queryByText('Alterou os limites de fase')).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Fases da vida' }))
    const limitsLog = await screen.findByRole('list', { name: 'Histórico de edições' })
    expect(within(limitsLog).getByText('Pequeno: adulto 9 → 10 meses')).toBeInTheDocument()
    expect(within(limitsLog).getByText('vet@edenbowls.com')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Fatores' }))
    const factorsLog = await screen.findByRole('list', { name: 'Histórico de edições' })
    expect(within(factorsLog).getByText('Salvou o rascunho #3')).toBeInTheDocument()
    expect(within(factorsLog).getByText('Sênior: 90 → 95')).toBeInTheDocument()
  })

  it('explains the data behind an "i"', async () => {
    const user = userEvent.setup()
    renderPage(veterinarian, {}, '/nutrition/settings?aba=fatores')
    const button = await screen.findByRole('button', { name: 'Sobre matriz de raças gigantes' })
    await user.click(button)
    expect(screen.getByRole('tooltip', { hidden: false })).toHaveTextContent('zootecnista Izabella')
    expect(screen.getByLabelText('Castrado · atividade baixa · acima do peso')).toBeInTheDocument()
  })

  it('a duplicate breed keeps the modal open with the error inside it', async () => {
    const user = userEvent.setup()
    renderPage(veterinarian, {
      respond: (call) => (call.path === '/api/v1/admin/life-stage/breeds' && call.method === 'POST'
        ? jsonResponse({ success: false, message: 'Exists', details: { code: 'life_stage_breed_exists' } }, 409)
        : undefined),
    }, '/nutrition/settings?aba=racas')

    await user.click(await screen.findByRole('button', { name: 'Incluir raça' }))
    const dialog = await screen.findByRole('dialog', { name: 'Incluir raça em Brasil' })
    await user.type(within(dialog).getByLabelText('Nome em português'), 'Dogue Alemão')
    await user.type(within(dialog).getByLabelText('Nome em inglês'), 'Great Dane')
    await user.click(within(dialog).getByRole('button', { name: 'Incluir raça' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Essa raça já está na lista deste mercado.')
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('a breed that changes pets asks for confirmation instead of the create modal', async () => {
    const user = userEvent.setup()
    const { calls } = renderPage(veterinarian, { preview: { pets_evaluated: 12, pets_changing: 2, transitions: [{ from: 'adult', to: 'senior', count: 2 }] } }, '/nutrition/settings?aba=racas')

    await user.click(await screen.findByRole('button', { name: 'Incluir raça' }))
    const dialog = await screen.findByRole('dialog', { name: 'Incluir raça em Brasil' })
    await user.type(within(dialog).getByLabelText('Nome em português'), 'Mastim Napolitano')
    await user.type(within(dialog).getByLabelText('Nome em inglês'), 'Neapolitan Mastiff')
    await user.click(within(dialog).getByRole('button', { name: 'Incluir raça' }))

    const confirm = await screen.findByRole('dialog', { name: 'Incluir raça' })
    expect(within(confirm).getByText('2 de 12 pets mudariam de fase em Brasil:')).toBeInTheDocument()
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    await user.click(within(confirm).getByRole('button', { name: 'Confirmar' }))
    expect(await screen.findByText('Mastim Napolitano incluída.')).toBeInTheDocument()
    expect(findCall(calls, 'POST', '/api/v1/admin/life-stage/breeds')).toBeTruthy()
  })

  it('a reader sees no add button', async () => {
    renderPage(operatorWriteUser, {}, '/nutrition/settings?aba=racas')
    expect(await screen.findByText('Great Dane')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Incluir raça' })).not.toBeInTheDocument()
  })

  it.each([
    ['the BR operator', operatorBr],
    ['the US operator', operatorUs],
    ['the admin', admin],
  ])('only the veterinarian changes the limits: %s reads them', async (_name, viewer) => {
    renderPage(viewer)
    expect(await screen.findByText('Somente leitura: só a veterinária altera os limites de fase.')).toBeInTheDocument()
    expect(await screen.findByLabelText('Médio: sênior a partir de')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Salvar limites' })).not.toBeInTheDocument()
  })

  it('the veterinarian edits the limits with no read-only note', async () => {
    renderPage(veterinarian)
    expect(await screen.findByLabelText('Médio: sênior a partir de')).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Salvar limites' })).toBeInTheDocument()
    expect(screen.queryByText(/Somente leitura/)).not.toBeInTheDocument()
  })

  it('opens on Raças, with the tabs in the order Raças, Fases da vida, Fatores', async () => {
    renderPage(veterinarian, {}, '/nutrition/settings')
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Raças', 'Fases da vida', 'Fatores'])
    expect(screen.getByRole('tab', { name: 'Raças' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByText('Raças com porte próprio em Brasil')).toBeInTheDocument()
  })

  it('Fatores shows the dog stages, matrices and giant breeds, and the cats their own factors and exponent', async () => {
    const user = userEvent.setup()
    const { calls } = renderPage(veterinarian, {}, '/nutrition/settings?aba=fatores')

    expect(await screen.findByRole('heading', { name: 'Fatores de estágio' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Matriz de manutenção' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Matriz de raças gigantes' })).toBeInTheDocument()
    expect(screen.getByLabelText('Gigante: Não castrado · atividade alta · abaixo do peso')).toHaveValue(115)
    expect(screen.getByRole('heading', { name: 'Raças gigantes' })).toBeInTheDocument()
    expect(screen.getByLabelText('EM do alimento para cães (kcal/kg)')).toHaveValue(1200)
    expect(screen.queryByLabelText('Gato em ambiente interno')).not.toBeInTheDocument()

    await user.click(within(screen.getByRole('group', { name: 'Espécie' })).getByRole('button', { name: 'Gatos' }))

    expect(await screen.findByLabelText('Gato em ambiente interno')).toHaveValue(60)
    expect(screen.getByLabelText('Gato ativo (atividade alta)')).toHaveValue(100)
    expect(screen.getByText(/Expoente do peso:/)).toHaveTextContent('0,67')
    expect(screen.getByLabelText('EM do alimento para gatos (kcal/kg)')).toHaveValue(1200)
    expect(screen.queryByRole('heading', { name: 'Matriz de manutenção' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Sênior')).not.toBeInTheDocument()

    // One parameter set for both species: saving from the cats view sends the dog values too.
    const cat = screen.getByLabelText('Gato em ambiente interno')
    await user.clear(cat)
    await user.type(cat, '65')
    await user.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
    await waitFor(() => expect(findCall(calls, 'PUT', '/api/v1/admin/nutrition/parameters/draft')).toBeTruthy())
    const saved = findCall(calls, 'PUT', '/api/v1/admin/nutrition/parameters/draft')?.body as { parameters: typeof PARAMETERS }
    expect(saved.parameters.base).toEqual({ cat: 65, cat_active: 100 })
    expect(saved.parameters.combination_giant).toEqual(PARAMETERS.combination_giant)
  })

  it('a set from an older API without the giant matrix still opens', async () => {
    const older: Partial<typeof PARAMETERS> = { ...PARAMETERS }
    delete older.combination_giant
    renderPage(veterinarian, {
      respond: (call) => (call.path === '/api/v1/admin/nutrition/parameters' && call.method === 'GET'
        ? jsonResponse({ published: { id: 1, parameters: older, publishedAt: null }, draft: null, history: [] })
        : undefined),
    }, '/nutrition/settings?aba=fatores')
    expect(await screen.findByRole('heading', { name: 'Matriz de raças gigantes' })).toBeInTheDocument()
    expect(screen.getByLabelText('Gigante: Não castrado · atividade alta · abaixo do peso')).toHaveValue(null)
  })

  it('an invalid cat factor while on dogs switches to the cats view', async () => {
    const user = userEvent.setup()
    renderPage(veterinarian, {
      respond: (call) => (call.path === '/api/v1/admin/nutrition/parameters/draft' && call.method === 'PUT'
        ? jsonResponse({ success: false, message: 'Invalid', details: { code: 'nutrition_parameters_invalid', fields: ['nem.cat'] } }, 422)
        : undefined),
    }, '/nutrition/settings?aba=fatores')

    await user.click(await screen.findByRole('button', { name: 'Salvar rascunho' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('EM do alimento para gatos (kcal/kg)')
    expect(await screen.findByLabelText('EM do alimento para gatos (kcal/kg)')).toHaveAttribute('aria-invalid', 'true')
  })

  it('the publication made by the deploy shows the system and its reason', async () => {
    renderPage(veterinarian, {
      respond: (call) => (call.path === '/api/v1/admin/nutrition/parameters' && call.method === 'GET'
        ? jsonResponse({
          published: { id: 9, parameters: PARAMETERS, publishedAt: null }, draft: null, history: [],
          audit: [{ id: 30, action: 'nutrition.parameters.publish', actorUserId: null, actorEmail: null, createdAt: '2026-11-15T12:00:00.000Z', metadata: { from_set_id: 4, to_set_id: 9, reason: 'requerimento_energetico' } }],
        })
        : undefined),
    }, '/nutrition/settings?aba=fatores')
    const log = await screen.findByRole('list', { name: 'Histórico de edições' })
    expect(within(log).getByText('Sistema')).toBeInTheDocument()
    expect(within(log).getByText(/documento da veterinária/)).toBeInTheDocument()
  })
})
