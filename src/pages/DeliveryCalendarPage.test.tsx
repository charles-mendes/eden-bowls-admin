import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DeliveryCalendarPage } from './DeliveryCalendarPage'
import { adminUser, jsonResponse, operatorWriteUser, readonlyUser } from '../test/fixtures'
import { findCall, installAdminFetchMock, type FetchCall } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

const YEAR = new Date().getFullYear()

type Row = {
  id: number
  market: 'BR' | 'US'
  closedOn: string
  label: string
  origin: string
  type: 'national' | 'regional' | 'carrier' | 'adhoc'
  active: boolean
  closesPreparation: boolean
  closesPickup: boolean
  closesDelivery: boolean
}

const row = (overrides: Partial<Row>): Row => ({
  id: 1, market: 'BR', closedOn: `${YEAR}-12-25`, label: 'Natal', origin: 'fixed', type: 'national', active: true,
  closesPreparation: true, closesPickup: true, closesDelivery: true, ...overrides,
})

const BR_ROWS: Row[] = [
  row({ id: 1, closedOn: `${YEAR}-02-08`, label: 'Carnaval (segunda)', origin: 'movable', active: false }),
  row({ id: 2, closedOn: `${YEAR}-03-29`, label: 'Aniversário de Curitiba', origin: 'regional', type: 'regional' }),
  row({ id: 3 }),
]

type CalendarServer = {
  rows?: Row[]
  history?: unknown[]
  syncs?: { delayed?: unknown[]; problems?: unknown[] }
  alerts?: unknown
  respond?: (call: FetchCall) => Response | undefined
}

function calendarRoutes(server: CalendarServer = {}) {
  return (call: FetchCall) => {
    const custom = server.respond?.(call)
    if (custom) return custom
    const params = new URLSearchParams(call.search)
    const market = params.get('market') || 'BR'
    if (call.path === '/api/v1/admin/delivery-calendar' && call.method === 'GET') {
      const year = params.get('year')
      return jsonResponse({ market, year: Number(year), items: (server.rows ?? BR_ROWS).filter((item) => item.market === market && item.closedOn.startsWith(`${year}-`)) })
    }
    if (call.path === '/api/v1/admin/delivery-calendar/history') return jsonResponse({ market, year: YEAR, items: server.history ?? [] })
    if (call.path === '/api/v1/admin/delivery-calendar/syncs') return jsonResponse({ market, delayMinutes: 15, delayed: server.syncs?.delayed ?? [], problems: server.syncs?.problems ?? [] })
    if (call.path === '/api/v1/admin/delivery-calendar/alerts') return jsonResponse(server.alerts ?? { market, upsCalendar: null })
    return undefined
  }
}

function renderCalendar(profile = operatorWriteUser, server: CalendarServer = {}, route = '/operations/delivery-calendar') {
  seedAuth()
  const mock = installAdminFetchMock(profile, { routes: calendarRoutes(server) })
  renderAuthedPage(<DeliveryCalendarPage />, route, '/operations/delivery-calendar')
  return mock
}

async function openHistoryTab() {
  fireEvent.click(await screen.findByRole('tab', { name: /Histórico/ }))
  return screen.findByRole('tabpanel', { name: /Histórico/ })
}

const historyEvent = (id: number, overrides: { action?: string; actorEmail?: string; label?: string } = {}) => ({
  id, actorUserId: 7, actorEmail: overrides.actorEmail ?? 'admin@edenbowls.com', action: overrides.action ?? 'delivery_calendar.create',
  createdAt: `${YEAR}-03-18T12:00:00.000Z`,
  metadata: {
    market: 'BR', closedOn: `${YEAR}-03-29`, type: 'adhoc', label: overrides.label ?? `Fechamento ${id}`, before: null,
    after: { active: true, closesPreparation: true, closesPickup: true, closesDelivery: true }, moved: [],
  },
})

describe('DeliveryCalendarPage list', () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('lists the market and year with type, active, and the three flags', async () => {
    const { calls } = renderCalendar()
    await waitFor(() => expect(screen.getByText('Aniversário de Curitiba')).toBeInTheDocument())
    const list = findCall(calls, 'GET', '/admin/delivery-calendar')
    expect(list?.search).toBe(`?market=BR&year=${YEAR}`)
    const carnaval = screen.getByText('Carnaval (segunda)').closest('tr') as HTMLElement
    expect(within(carnaval).getByText('Nacional')).toBeInTheDocument()
    expect(within(carnaval).getByText('Inativa')).toBeInTheDocument()
    expect(within(carnaval).getAllByText('Fechado')).toHaveLength(3)
    expect(within(screen.getByText('Aniversário de Curitiba').closest('tr') as HTMLElement).getByText('Regional')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Novo fechamento' })).toBeInTheDocument()
  })

  it('shows an empty state in Portuguese for a year with no rows', async () => {
    renderCalendar(operatorWriteUser, { rows: [] })
    await waitFor(() => expect(screen.getByText('Nenhum dia fechado cadastrado para este ano.')).toBeInTheDocument())
  })

  it('changing the year loads that year', async () => {
    const { calls } = renderCalendar()
    await waitFor(() => expect(screen.getByText('Natal')).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('Ano'), { target: { value: String(YEAR + 1) } })
    await waitFor(() => expect(screen.getByText('Nenhum dia fechado cadastrado para este ano.')).toBeInTheDocument())
    expect(calls.some((call) => call.path === '/api/v1/admin/delivery-calendar' && call.search === `?market=BR&year=${YEAR + 1}`)).toBe(true)
  })

  it('readonly sees the list without write controls', async () => {
    renderCalendar(readonlyUser)
    await waitFor(() => expect(screen.getByText('Natal')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Novo fechamento' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Editar|Desativar|Reativar|Remover/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Ações' })).not.toBeInTheDocument()
  })

  it('a session scoped to one market cannot pick the other', async () => {
    renderCalendar(operatorWriteUser)
    await waitFor(() => expect(screen.getByText('Natal')).toBeInTheDocument())
    const select = screen.getByLabelText('Mercado')
    expect(select).toBeDisabled()
    expect(within(select).queryByRole('option', { name: 'Estados Unidos' })).not.toBeInTheDocument()
  })

  it('an admin switches between markets', async () => {
    const usRow = row({ id: 9, market: 'US', closedOn: `${YEAR}-11-26`, label: 'Thanksgiving', origin: 'ups', type: 'carrier' })
    const { calls } = renderCalendar(adminUser, { rows: [...BR_ROWS, usRow] })
    await waitFor(() => expect(screen.getByText('Natal')).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('Mercado'), { target: { value: 'US' } })
    await waitFor(() => expect(screen.getByText('Thanksgiving')).toBeInTheDocument())
    expect(screen.getByText('Transportadora (UPS)')).toBeInTheDocument()
    expect(calls.some((call) => call.search === `?market=US&year=${YEAR}`)).toBe(true)
  })
})

const affected = (overrides: Record<string, unknown> = {}) => ({
  stripeSubscriptionId: 'sub_ana', ledgerId: 42, userId: 7, deliveryId: 'current',
  preparationDay: `${YEAR}-03-30`, deliveryDate: `${YEAR}-03-30`, newPreparationDay: `${YEAR}-03-31`, newDeliveryDate: `${YEAR}-03-31`,
  locked: false, lockReason: null, move: 'projection_only', ...overrides,
})

function previewResponder(preview: Record<string, unknown>, save?: (call: FetchCall) => Response | undefined) {
  return (call: FetchCall) => {
    if (call.path === '/api/v1/admin/delivery-calendar/preview' && call.method === 'POST') {
      return jsonResponse({ market: 'BR', change: call.body, affected: [], shortNotice: false, ...preview })
    }
    if (save && call.method !== 'GET') return save(call)
    return undefined
  }
}

async function openCreate() {
  await waitFor(() => expect(screen.getByText('Natal')).toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: 'Novo fechamento' }))
  const dialog = await screen.findByRole('dialog')
  return dialog
}

function fillDraft(dialog: HTMLElement, { type = 'adhoc', date = `${YEAR}-03-30`, label = 'Manutenção' } = {}) {
  fireEvent.change(within(dialog).getByLabelText('Tipo'), { target: { value: type } })
  fireEvent.change(within(dialog).getByLabelText('Data'), { target: { value: date } })
  fireEvent.change(within(dialog).getByLabelText('Rótulo'), { target: { value: label } })
}

describe('DeliveryCalendarPage create and edit', () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('offers regional and ad hoc in Brazil, carrier only in the US, and never national', async () => {
    renderCalendar(adminUser, { rows: BR_ROWS })
    const dialog = await openCreate()
    const types = () => within(within(dialog).getByLabelText('Tipo')).getAllByRole('option').map((option) => option.textContent)
    expect(types()).toEqual(['Pontual', 'Regional'])
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    fireEvent.change(screen.getByLabelText('Mercado'), { target: { value: 'US' } })
    await waitFor(() => expect(screen.getByText('Nenhum dia fechado cadastrado para este ano.')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Novo fechamento' }))
    const usDialog = await screen.findByRole('dialog')
    expect(within(within(usDialog).getByLabelText('Tipo')).getAllByRole('option').map((option) => option.textContent))
      .toEqual(['Pontual', 'Regional', 'Transportadora (UPS)'])
  })

  it('needs at least one flag before asking for the preview', async () => {
    const { calls } = renderCalendar()
    const dialog = await openCreate()
    fillDraft(dialog)
    for (const name of ['Preparo', 'Coleta', 'Entrega']) fireEvent.click(within(dialog).getByLabelText(name))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ver entregas afetadas' }))
    expect(await within(dialog).findByText('Marque ao menos preparo, coleta ou entrega.')).toBeInTheDocument()
    expect(findCall(calls, 'POST', '/admin/delivery-calendar/preview')).toBeUndefined()
  })

  it('previews the affected deliveries, marks the locked one, and blocks the save', async () => {
    renderCalendar(operatorWriteUser, {
      respond: previewResponder({ affected: [affected(), affected({ stripeSubscriptionId: 'sub_cris', locked: true, lockReason: 'in_production' })] }),
    })
    const dialog = await openCreate()
    fillDraft(dialog)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ver entregas afetadas' }))
    expect(await within(dialog).findByText('sub_cris')).toBeInTheDocument()
    expect(within(dialog).getByText('Travada (em produção)')).toBeInTheDocument()
    expect(within(dialog).getByText('Editável')).toBeInTheDocument()
    expect(within(dialog).getByText('Há entregas travadas nesta data. Resolva-as antes de fechar o dia.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Salvar' })).toBeDisabled()
  })

  it('shows how each delivery moves, including a pending change, and the short-notice warning', async () => {
    renderCalendar(operatorWriteUser, {
      respond: previewResponder({
        shortNotice: true,
        affected: [
          affected({ move: 'stripe_sync' }),
          affected({ stripeSubscriptionId: 'sub_bia', move: 'pending_change', pendingTrialEnd: { previous: `${YEAR}-03-30T03:00:00.000Z`, next: `${YEAR}-03-31T03:00:00.000Z` } }),
        ],
      }),
    })
    const dialog = await openCreate()
    fillDraft(dialog)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ver entregas afetadas' }))
    expect(await within(dialog).findByText('Cobrança movida no Stripe')).toBeInTheDocument()
    expect(within(dialog).getByText('Mudança pendente remarcada')).toBeInTheDocument()
    expect(within(dialog).getByText(/→/)).toBeInTheDocument()
    expect(within(dialog).getByText('Esta data está a menos de 7 dias. O fechamento pode ser salvo, mas avise a operação.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Salvar' })).toBeEnabled()
  })

  it('saves after the preview and reloads', async () => {
    const { calls } = renderCalendar(operatorWriteUser, {
      respond: previewResponder({ affected: [affected()] }, (call) => (
        call.method === 'POST' && call.path === '/api/v1/admin/delivery-calendar'
          ? jsonResponse({ market: 'BR', row: { ...call.body as object, id: 50 }, affected: [affected()], syncIds: [], auditEventId: 1 })
          : undefined
      )),
    })
    const dialog = await openCreate()
    fillDraft(dialog)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ver entregas afetadas' }))
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Calendário salvo. 1 entrega(s) remarcada(s).')).toBeInTheDocument()
    const created = findCall(calls, 'POST', '/admin/delivery-calendar')
    expect(created?.body).toMatchObject({ market: 'BR', type: 'adhoc', closedOn: `${YEAR}-03-30`, label: 'Manutenção', closesPreparation: true })
  })

  it('a delivery locked after the preview comes back as a refusal naming it', async () => {
    renderCalendar(operatorWriteUser, {
      respond: previewResponder({ affected: [affected()] }, (call) => (
        call.method === 'POST' && call.path === '/api/v1/admin/delivery-calendar'
          ? jsonResponse({ message: 'Há entregas travadas nessa data. Resolva-as antes de fechar o dia.', details: { code: 'delivery_locked', subscriptions: [{ stripeSubscriptionId: 'sub_ana', deliveryId: 'current', lockReason: 'ready' }] } }, 409)
          : undefined
      )),
    })
    const dialog = await openCreate()
    fillDraft(dialog)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ver entregas afetadas' }))
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Salvar' }))
    const lockedList = await within(dialog).findByRole('list', { name: 'Entregas travadas' })
    expect(within(lockedList).getByText('sub_ana: pronta')).toBeInTheDocument()
  })

  it('editing flags previews the change and sends only what changed', async () => {
    const { calls } = renderCalendar(operatorWriteUser, {
      respond: previewResponder({}, (call) => (
        call.method === 'PATCH' ? jsonResponse({ market: 'BR', row: BR_ROWS[1], affected: [], syncIds: [], auditEventId: 2 }) : undefined
      )),
    })
    await waitFor(() => expect(screen.getByText('Aniversário de Curitiba')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Editar marcações de Aniversário de Curitiba' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByLabelText('Coleta'))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ver entregas afetadas' }))
    expect(await within(dialog).findByText('Nenhuma entrega é afetada por esta mudança.')).toBeInTheDocument()
    expect(findCall(calls, 'POST', '/admin/delivery-calendar/preview')?.body).toEqual({ market: 'BR', id: 2, closesPickup: false })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(findCall(calls, 'PATCH', '/admin/delivery-calendar/2')?.body).toEqual({ market: 'BR', closesPickup: false }))
  })
})

describe('DeliveryCalendarPage deactivate, reactivate, and remove', () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  const writes = (call: FetchCall) => (call.method === 'PATCH' || call.method === 'DELETE'
    ? jsonResponse({ market: 'BR', row: BR_ROWS[0], removed: BR_ROWS[1], affected: [], syncIds: [], auditEventId: 3 })
    : undefined)

  it('a national holiday offers deactivation and no removal', async () => {
    renderCalendar()
    await waitFor(() => expect(screen.getByText('Natal')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Desativar Natal' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remover Natal' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remover Aniversário de Curitiba' })).toBeInTheDocument()
  })

  it('deactivation saves at once and says scheduled deliveries stay', async () => {
    const { calls } = renderCalendar(operatorWriteUser, { respond: writes })
    await waitFor(() => expect(screen.getByText('Natal')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Desativar Natal' }))
    await waitFor(() => expect(findCall(calls, 'PATCH', '/admin/delivery-calendar/3')?.body).toEqual({ market: 'BR', active: false }))
    expect(await screen.findByText(/Natal desativado/)).toBeInTheDocument()
    expect(findCall(calls, 'POST', '/admin/delivery-calendar/preview')).toBeUndefined()
  })

  it('reactivation goes through the preview first', async () => {
    const { calls } = renderCalendar(operatorWriteUser, {
      respond: (call) => (call.path === '/api/v1/admin/delivery-calendar/preview'
        ? jsonResponse({ market: 'BR', change: call.body, affected: [affected({ preparationDay: `${YEAR}-02-08` })], shortNotice: false })
        : writes(call)),
    })
    await waitFor(() => expect(screen.getByText('Carnaval (segunda)')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Reativar Carnaval (segunda)' }))
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText('sub_ana')).toBeInTheDocument()
    expect(findCall(calls, 'POST', '/admin/delivery-calendar/preview')?.body).toEqual({ market: 'BR', id: 1, active: true })
    expect(findCall(calls, 'PATCH', '/admin/delivery-calendar/1')).toBeUndefined()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(findCall(calls, 'PATCH', '/admin/delivery-calendar/1')?.body).toEqual({ market: 'BR', active: true }))
  })

  it('removal asks first, then deletes', async () => {
    const { calls } = renderCalendar(operatorWriteUser, { respond: writes })
    await waitFor(() => expect(screen.getByText('Aniversário de Curitiba')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Remover Aniversário de Curitiba' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/Entregas já remarcadas e cobranças já movidas ficam como estão/)).toBeInTheDocument()
    expect(findCall(calls, 'DELETE', '/admin/delivery-calendar/2')).toBeUndefined()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remover' }))
    await waitFor(() => expect(findCall(calls, 'DELETE', '/admin/delivery-calendar/2')?.search).toBe('?market=BR'))
  })
})

const HISTORY = [
  {
    id: 3, actorUserId: 8, actorEmail: 'op@edenbowls.com', action: 'delivery_calendar.sync_resend', createdAt: `${YEAR}-03-20T12:00:00.000Z`,
    metadata: { market: 'BR', closedOn: `${YEAR}-03-29`, syncId: 11, stripeSubscriptionId: 'sub_late', previousStatus: 'conflict', expectedTrialEnd: `${YEAR}-03-29T03:00:00.000Z`, foundTrialEnd: `${YEAR}-04-05T03:00:00.000Z`, targetTrialEnd: `${YEAR}-03-31T03:00:00.000Z` },
  },
  {
    id: 2, actorUserId: 8, actorEmail: 'op@edenbowls.com', action: 'delivery_calendar.remove', createdAt: `${YEAR}-03-19T12:00:00.000Z`,
    metadata: { market: 'BR', closedOn: `${YEAR}-03-30`, type: 'adhoc', label: 'Falta de energia', before: { active: true, closesPreparation: true, closesPickup: false, closesDelivery: true }, after: null, moved: [] },
  },
  {
    id: 1, actorUserId: 7, actorEmail: 'admin@edenbowls.com', action: 'delivery_calendar.create', createdAt: `${YEAR}-03-18T12:00:00.000Z`,
    metadata: {
      market: 'BR', closedOn: `${YEAR}-03-29`, type: 'regional', label: 'Aniversário de Curitiba', before: null,
      after: { active: true, closesPreparation: true, closesPickup: true, closesDelivery: true },
      moved: [{ stripeSubscriptionId: 'sub_ana', deliveryId: 'current', previousPreparationDay: `${YEAR}-03-29`, newPreparationDay: `${YEAR}-03-31`, move: 'stripe_sync' }],
    },
  },
]

const sync = (overrides: Record<string, unknown> = {}) => ({
  id: 11, stripeSubscriptionId: 'sub_late', market: 'BR', auditEventId: 1,
  expectedTrialEnd: `${YEAR + 1}-03-29T03:00:00.000Z`, targetTrialEnd: `${YEAR + 1}-03-31T03:00:00.000Z`, foundTrialEnd: null,
  status: 'failed', attempts: 8, lastError: 'Stripe timeout', createdAt: `${YEAR}-03-18T12:00:00.000Z`, ...overrides,
})

describe('DeliveryCalendarPage history', () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('lists the events newest first with actor, action, before and after, and moved subscriptions', async () => {
    renderCalendar(readonlyUser, { history: HISTORY })
    const panel = await openHistoryTab()
    const actions = await within(within(panel).getByRole('table')).findAllByText(/^(Inclusão|Remoção|Reenvio ao Stripe)$/)
    expect(actions.map((node) => node.textContent)).toEqual(['Reenvio ao Stripe', 'Remoção', 'Inclusão'])
    const removed = screen.getByText('Falta de energia').closest('tr') as HTMLElement
    expect(within(removed).getByText('Ativa · fecha Preparo, Entrega')).toBeInTheDocument()
    const created = within(within(panel).getByRole('table')).getByText('Inclusão').closest('tr') as HTMLElement
    expect(within(created).getByText(/sub_ana: .* → .* · Cobrança movida no Stripe/)).toBeInTheDocument()
    const resend = within(within(panel).getByRole('table')).getByText('Reenvio ao Stripe').closest('tr') as HTMLElement
    expect(within(resend).getByText('sub_late')).toBeInTheDocument()
    expect(within(resend).getByText(/^Esperada .* · encontrada /)).toBeInTheDocument()
  })

  it('says when the year has no events', async () => {
    renderCalendar()
    await openHistoryTab()
    expect(await screen.findByText('Nenhuma mudança registrada neste ano.')).toBeInTheDocument()
  })

  it('keeps the history in its own tab, out of the closed days view', async () => {
    renderCalendar(readonlyUser, { rows: BR_ROWS, history: HISTORY })
    const daysTab = await screen.findByRole('tab', { name: /Dias fechados/ })
    expect(daysTab).toHaveAttribute('aria-selected', 'true')
    await screen.findByText('Natal')
    expect(screen.queryByText('Falta de energia')).not.toBeInTheDocument()
    await openHistoryTab()
    expect(screen.getByRole('tab', { name: /Histórico/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Falta de energia')).toBeInTheDocument()
    expect(screen.queryByRole('tabpanel', { name: /Dias fechados/ })).not.toBeInTheDocument()
  })

  it('opens straight on the history tab from the URL', async () => {
    renderCalendar(readonlyUser, { history: HISTORY }, '/operations/delivery-calendar?aba=historico')
    expect(await screen.findByRole('tabpanel', { name: /Histórico/ })).toBeInTheDocument()
    expect(await screen.findByText('Falta de energia')).toBeInTheDocument()
  })

  it('filters by action, actor, and search text, and clears the filters', async () => {
    renderCalendar(readonlyUser, { history: HISTORY })
    const panel = await openHistoryTab()
    await within(panel).findByText('Falta de energia')

    fireEvent.change(within(panel).getByLabelText('Ação'), { target: { value: 'delivery_calendar.remove' } })
    expect(within(panel).getByText('Falta de energia')).toBeInTheDocument()
    expect(within(panel).queryByText('Aniversário de Curitiba')).not.toBeInTheDocument()

    fireEvent.click(within(panel).getAllByRole('button', { name: 'Limpar filtros' })[0])
    fireEvent.change(within(panel).getByLabelText('Responsável'), { target: { value: 'admin@edenbowls.com' } })
    expect(within(panel).getByText('Aniversário de Curitiba')).toBeInTheDocument()
    expect(within(panel).queryByText('Falta de energia')).not.toBeInTheDocument()

    fireEvent.click(within(panel).getAllByRole('button', { name: 'Limpar filtros' })[0])
    fireEvent.change(within(panel).getByLabelText('Buscar no histórico'), { target: { value: 'sub_ana' } })
    expect(within(panel).getByText('Aniversário de Curitiba')).toBeInTheDocument()
    expect(within(panel).getByText('Mostrando 1–1 de 1 (de 3 no ano)')).toBeInTheDocument()

    fireEvent.change(within(panel).getByLabelText('Buscar no histórico'), { target: { value: 'nada disso' } })
    expect(within(panel).getByText('Nenhuma mudança corresponde aos filtros.')).toBeInTheDocument()
  })

  it('pages the history twenty events at a time', async () => {
    const events = Array.from({ length: 45 }, (_, index) => historyEvent(45 - index, { label: `Fechamento ${45 - index}` }))
    renderCalendar(readonlyUser, { history: events })
    const panel = await openHistoryTab()
    expect(await within(panel).findByText('Mostrando 1–20 de 45')).toBeInTheDocument()
    expect(within(panel).getByText('Página 1 de 3')).toBeInTheDocument()
    expect(within(panel).getByText('Fechamento 45')).toBeInTheDocument()
    expect(within(panel).queryByText('Fechamento 25')).not.toBeInTheDocument()

    fireEvent.click(within(panel).getByRole('button', { name: 'Próxima' }))
    expect(within(panel).getByText('Mostrando 21–40 de 45')).toBeInTheDocument()
    expect(within(panel).getByText('Fechamento 25')).toBeInTheDocument()

    fireEvent.click(within(panel).getByRole('button', { name: 'Próxima' }))
    expect(within(panel).getByText('Mostrando 41–45 de 45')).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Próxima' })).toBeDisabled()

    fireEvent.change(within(panel).getByLabelText('Buscar no histórico'), { target: { value: 'Fechamento 4' } })
    expect(within(panel).getByText('Mostrando 1–7 de 7 (de 45 no ano)')).toBeInTheDocument()
    expect(within(panel).queryByRole('button', { name: 'Próxima' })).not.toBeInTheDocument()
  })
})

describe('DeliveryCalendarPage alerts', () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('warns when the UPS calendar runs out, for readonly too', async () => {
    renderCalendar(readonlyUser, { alerts: { market: 'BR', upsCalendar: { coveredThrough: `${YEAR}-12-31`, missingYear: YEAR + 1, daysLeft: 80, warn: true } } })
    const alert = await screen.findByRole('alert', { name: 'Calendário UPS' })
    expect(alert).toHaveTextContent(`O calendário UPS de ${YEAR + 1} ainda não foi cadastrado.`)
    expect(alert).toHaveTextContent('(80 dias)')
  })

  it('warns at once when no UPS year is loaded', async () => {
    renderCalendar(readonlyUser, { alerts: { market: 'BR', upsCalendar: { coveredThrough: null, missingYear: YEAR, daysLeft: null, warn: true } } })
    expect(await screen.findByRole('alert', { name: 'Calendário UPS' })).toHaveTextContent('Nenhum ano do calendário UPS está cadastrado.')
  })

  it('lists delayed syncs and, together, failed and conflict syncs with the found date', async () => {
    renderCalendar(readonlyUser, {
      syncs: {
        delayed: [sync({ id: 10, stripeSubscriptionId: 'sub_wait', status: 'pending', attempts: 0, lastError: null })],
        problems: [sync(), sync({ id: 12, stripeSubscriptionId: 'sub_conf', status: 'conflict', foundTrialEnd: `${YEAR + 1}-04-05T03:00:00.000Z`, lastError: null })],
      },
    })
    await screen.findByText('Sincronizações com o Stripe')
    expect(within(screen.getByText('sub_wait').closest('tr') as HTMLElement).getByText('Atrasada')).toBeInTheDocument()
    expect(within(screen.getByText('sub_late').closest('tr') as HTMLElement).getByText('Stripe timeout')).toBeInTheDocument()
    const conflict = screen.getByText('sub_conf').closest('tr') as HTMLElement
    expect(within(conflict).getByText('Conflito')).toBeInTheDocument()
    expect(within(conflict).getAllByRole('cell')[4].textContent).not.toBe('—')
  })

  it('shows no alert when there is nothing to report', async () => {
    renderCalendar()
    await waitFor(() => expect(screen.getByText('Natal')).toBeInTheDocument())
    expect(screen.queryByRole('alert', { name: 'Calendário UPS' })).not.toBeInTheDocument()
    expect(screen.queryByText('Sincronizações com o Stripe')).not.toBeInTheDocument()
  })
})

describe('DeliveryCalendarPage resend', () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  const resendOk = (call: FetchCall) => (call.path.endsWith('/resend') ? jsonResponse({ syncId: 11, status: 'pending' }) : undefined)

  it('readonly sees the syncs but no resend button', async () => {
    renderCalendar(readonlyUser, { syncs: { problems: [sync()] } })
    await screen.findByText('sub_late')
    expect(screen.queryByRole('button', { name: 'Reenviar' })).not.toBeInTheDocument()
  })

  it('resends a failed sync after confirming', async () => {
    const { calls } = renderCalendar(operatorWriteUser, { syncs: { problems: [sync()] }, respond: resendOk })
    fireEvent.click(await screen.findByRole('button', { name: 'Reenviar' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/volta para a fila/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reenviar' }))
    await waitFor(() => expect(findCall(calls, 'POST', '/syncs/11/resend')?.body).toEqual({ market: 'BR' }))
    expect(await screen.findByText('Sincronização de sub_late reenviada.')).toBeInTheDocument()
  })

  it('a conflict shows the found and the target dates and warns that it overwrites Stripe', async () => {
    const found = `${YEAR + 1}-04-05T03:00:00.000Z`
    const { calls } = renderCalendar(operatorWriteUser, { syncs: { problems: [sync({ status: 'conflict', foundTrialEnd: found })] }, respond: resendOk })
    fireEvent.click(await screen.findByRole('button', { name: 'Reenviar' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Encontrada no Stripe')).toBeInTheDocument()
    expect(within(dialog).getByText('Data alvo')).toBeInTheDocument()
    expect(within(dialog).getByText(/Reenviar substitui o valor que está no Stripe/)).toBeInTheDocument()
    expect(findCall(calls, 'POST', '/syncs/11/resend')).toBeUndefined()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reenviar' }))
    await waitFor(() => expect(findCall(calls, 'POST', '/syncs/11/resend')?.body).toEqual({ market: 'BR', foundTrialEnd: found }))
  })

  it('a conflict whose Stripe value changed again shows the new value and keeps the dialog open', async () => {
    const newer = `${YEAR + 1}-04-12T03:00:00.000Z`
    renderCalendar(operatorWriteUser, {
      syncs: { problems: [sync({ status: 'conflict', foundTrialEnd: `${YEAR + 1}-04-05T03:00:00.000Z` })] },
      respond: (call) => (call.path.endsWith('/resend')
        ? jsonResponse({ message: 'O valor no Stripe mudou. Revise antes de reenviar.', details: { code: 'sync_conflict_changed', foundTrialEnd: newer } }, 409)
        : undefined),
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Reenviar' }))
    const dialog = await screen.findByRole('dialog')
    const before = within(dialog).getByText('Encontrada no Stripe').nextElementSibling?.textContent
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reenviar' }))
    expect(await within(dialog).findByText(/O valor no Stripe mudou desde que você abriu esta tela/)).toBeInTheDocument()
    expect(within(dialog).getByText('Encontrada no Stripe').nextElementSibling?.textContent).not.toBe(before)
  })

  it('a past target is refused with the reason', async () => {
    renderCalendar(operatorWriteUser, {
      syncs: { problems: [sync()] },
      respond: (call) => (call.path.endsWith('/resend')
        ? jsonResponse({ message: 'A data alvo já passou; a cobrança que ela movia já aconteceu.', details: { code: 'sync_target_past' } }, 422)
        : undefined),
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Reenviar' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reenviar' }))
    expect(await within(dialog).findByText('A data alvo já passou; a cobrança que ela movia já aconteceu.')).toBeInTheDocument()
  })
})
