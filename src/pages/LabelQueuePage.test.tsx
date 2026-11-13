import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LabelQueuePage } from './LabelQueuePage'
import { addressIssue, operatorUsWriteUser, operatorWriteUser, readonlyUser, upsPickupRequested } from '../test/fixtures'
import { LABELS_TIMEZONE, todayIn } from '../lib/deliveryRange'
import { installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

const printLabels = vi.hoisted(() => vi.fn())
vi.mock('../lib/printLabel', () => ({ printLabels }))

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const order = (n: number, extra: Record<string, unknown> = {}) => ({
  subscription_id: String(n),
  stripe_subscription_id: `sub_${n}`,
  invoice_id: `in_${n}`,
  customer_name: `Cliente ${n}`,
  city: 'Miami',
  zipcode: '33101',
  production_status: 'ready',
  subscription_status: 'active',
  delivery_date: '2026-11-05',
  shipment: null,
  issues: [],
  ...extra,
})
const created = (n: number) => order(n, { issues: undefined, shipment: { id: 100 + n, status: 'created', tracking_number: `1Z${n}`, has_label: true } })

type Purchase = { status: number; body: unknown }
type Order = ReturnType<typeof order>
type Queue = { ready: Order[]; unresolved: Order[]; created: Order[]; truncated: boolean; range?: { from: string; to: string; default: boolean }; later?: number; next_from?: string | null }
type InstallOptions = { queue?: Queue; purchases?: Record<string, Purchase>; missingLabels?: string[] }

function install(user = operatorUsWriteUser, {
  queue = { ready: [order(1), order(2), order(3)], unresolved: [], created: [], truncated: false },
  purchases = {},
  missingLabels = [],
}: InstallOptions = {}) {
  return installAdminFetchMock(user, {
    routes: ({ path, method, body }: { path: string; method: string; body: unknown }) => {
      if (path === '/api/v1/admin/shipments/queue' && method === 'GET') return json(200, { success: true, data: queue })
      const buy = path.match(/^\/api\/v1\/admin\/billing\/subscriptions\/([^/]+)\/shipments$/)
      if (buy && method === 'POST') {
        const invoice = (body as { invoice_id: string }).invoice_id
        const preset = purchases[invoice]
        return preset
          ? json(preset.status, preset.body)
          : json(200, { success: true, data: { reused: false, shipment: { id: `ship_${buy[1]}`, has_label: true } } })
      }
      const label = path.match(/^\/api\/v1\/admin\/shipments\/([^/]+)\/label$/)
      if (label && method === 'GET') {
        return missingLabels.includes(label[1])
          ? json(404, { message: 'Label file not found.' })
          : new Response('GIF89a', { status: 200, headers: { 'Content-Type': 'image/gif' } })
      }
      return undefined
    },
  })
}

const render = (route = '/operations/labels') => renderAuthedPage(<LabelQueuePage />, route, '/operations/labels')
const queueCalls = (calls: Array<{ method: string; path: string; search?: string }>) => calls.filter((call) => call.method === 'GET' && call.path === '/api/v1/admin/shipments/queue')
const select = async (user: ReturnType<typeof userEvent.setup>, name: string) => user.click(await screen.findByRole('checkbox', { name: `Selecionar ${name}` }))
const purchases = (calls: Array<{ method: string; path: string; body?: unknown }>) => calls.filter((call) => call.method === 'POST' && call.path.endsWith('/shipments'))

describe('LabelQueuePage', () => {
  beforeEach(() => {
    seedAuth()
    printLabels.mockReset().mockResolvedValue(undefined)
  })
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  // delivery-instructions: whoever packs the box reads them; the UPS label does not carry them.
  it('shows the delivery instructions of each order with their source', async () => {
    install(operatorUsWriteUser, {
      queue: {
        ready: [
          order(1, { delivery_instructions: 'Leave at back door', delivery_instructions_source: 'subscription' }),
          order(2, { delivery_instructions: 'Ring twice', delivery_instructions_source: 'profile' }),
          order(3, { delivery_instructions: null, delivery_instructions_source: null }),
        ],
        unresolved: [], created: [], truncated: false,
      },
    })
    render()

    expect(await screen.findByText('Instruções: Leave at back door')).toBeInTheDocument()
    expect(screen.getByText('Instruções (do perfil): Ring twice')).toBeInTheDocument()
    expect(screen.queryByText('Sem instruções')).toBeNull()
  })

  it('Several orders bought: one purchase per order, one at a time, then one print job', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
    const { calls } = install()
    render()

    for (const n of [1, 2, 3]) await select(user, `Cliente ${n}`)
    await user.click(screen.getByRole('button', { name: 'Comprar e imprimir' }))

    await waitFor(() => expect(printLabels).toHaveBeenCalledTimes(1))
    expect(purchases(calls).map((call) => call.path)).toEqual([
      '/api/v1/admin/billing/subscriptions/1/shipments',
      '/api/v1/admin/billing/subscriptions/2/shipments',
      '/api/v1/admin/billing/subscriptions/3/shipments',
    ])
    expect(printLabels.mock.calls[0][0]).toHaveLength(3)
    expect(screen.getByTestId('outcome-in_2')).toHaveTextContent('Etiqueta comprada')
  })

  it('One purchase fails in the middle: the others are bought and only they print', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
    install(operatorUsWriteUser, { purchases: { in_2: { status: 422, body: { message: 'Address not valid.', code: 'ups_upstream_error' } } } })
    render()

    for (const n of [1, 2, 3]) await select(user, `Cliente ${n}`)
    await user.click(screen.getByRole('button', { name: 'Comprar e imprimir' }))

    await waitFor(() => expect(printLabels).toHaveBeenCalledTimes(1))
    expect(printLabels.mock.calls[0][0]).toHaveLength(2)
    expect(screen.getByTestId('outcome-in_2')).toHaveTextContent('Falhou: Address not valid.')
  })

  it.each([
    ['a 409 for a purchase still in flight', 409, 'ups_shipment_unresolved'],
    ['a 502 with no confirmed UPS outcome', 502, 'ups_shipment_unknown'],
  ])('%s shows in progress, is not printed and offers no retry', async (_name, status, code) => {
    const user = userEvent.setup()
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
    install(operatorUsWriteUser, { purchases: { in_2: { status, body: { message: 'Check UPS.', code, details: { code, shipment_id: 77 } } } } })
    render()

    for (const n of [1, 2]) await select(user, `Cliente ${n}`)
    await user.click(screen.getByRole('button', { name: 'Comprar e imprimir' }))

    await waitFor(() => expect(printLabels).toHaveBeenCalledTimes(1))
    expect(printLabels.mock.calls[0][0]).toHaveLength(1)
    expect(screen.getByTestId('outcome-in_2')).toHaveTextContent('Em andamento na UPS (envio 77)')
  })

  it('Label bought elsewhere meanwhile: shows it already had one and still prints it', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
    install(operatorUsWriteUser, { purchases: { in_1: { status: 200, body: { success: true, data: { reused: true, shipment: { id: 'ship_old', has_label: true } } } } } })
    render()

    await select(user, 'Cliente 1')
    await user.click(screen.getByRole('button', { name: 'Comprar e imprimir' }))

    await waitFor(() => expect(printLabels).toHaveBeenCalledTimes(1))
    expect(screen.getByTestId('outcome-in_1')).toHaveTextContent('Já tinha etiqueta')
    expect(printLabels.mock.calls[0][0]).toHaveLength(1)
  })

  it('Nothing confirmed: no label is bought', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false))
    const { calls } = install()
    render()

    await select(user, 'Cliente 1')
    await user.click(screen.getByRole('button', { name: 'Comprar e imprimir' }))

    expect(purchases(calls)).toHaveLength(0)
    expect(printLabels).not.toHaveBeenCalled()
  })

  it('asks a second time, naming orders not ready or not active, and buys nothing when refused', async () => {
    const user = userEvent.setup()
    const confirm = vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false)
    vi.stubGlobal('confirm', confirm)
    const { calls } = install(operatorUsWriteUser, {
      queue: { ready: [order(1, { production_status: 'to_prepare' }), order(2, { subscription_status: 'paused' })], unresolved: [], created: [], truncated: false },
    })
    render()

    await select(user, 'Cliente 1')
    await select(user, 'Cliente 2')
    await user.click(screen.getByRole('button', { name: 'Comprar e imprimir' }))

    expect(confirm).toHaveBeenCalledTimes(2)
    expect(confirm.mock.calls[1][0]).toContain('Cliente 1 (A preparar, Ativa)')
    expect(confirm.mock.calls[1][0]).toContain('Cliente 2 (Pronto, Pausada)')
    expect(purchases(calls)).toHaveLength(0)
  })

  it('sends confirm_not_ready only for the orders confirmed as not ready', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
    const { calls } = install(operatorUsWriteUser, {
      queue: { ready: [order(1, { production_status: 'in_production' }), order(2)], unresolved: [], created: [], truncated: false },
    })
    render()

    await select(user, 'Cliente 1')
    await select(user, 'Cliente 2')
    await user.click(screen.getByRole('button', { name: 'Comprar e imprimir' }))

    await waitFor(() => expect(printLabels).toHaveBeenCalledTimes(1))
    expect(purchases(calls).map((call) => call.body)).toEqual([
      { invoice_id: 'in_1', confirm_not_ready: true },
      { invoice_id: 'in_2' },
    ])
  })

  it('ends an order the API says is not ready as "Precisa confirmar" and buys the others', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
    install(operatorUsWriteUser, {
      purchases: {
        in_2: {
          status: 409,
          body: { message: 'Not ready', code: 'ups_label_needs_confirmation', details: { code: 'ups_label_needs_confirmation', reasons: [{ code: 'production_not_ready', production_status: 'in_production' }] } },
        },
      },
    })
    render()

    for (const n of [1, 2, 3]) await select(user, `Cliente ${n}`)
    await user.click(screen.getByRole('button', { name: 'Comprar e imprimir' }))

    await waitFor(() => expect(printLabels).toHaveBeenCalledTimes(1))
    expect(printLabels.mock.calls[0][0]).toHaveLength(2)
    expect(screen.getByTestId('outcome-in_2')).toHaveTextContent('Precisa confirmar: Preparo: Em preparo. Nada foi comprado')
    expect(screen.getByTestId('outcome-in_3')).toHaveTextContent('Etiqueta comprada')
  })

  it('scrolls to Verificar na UPS once the queue loads when opened at #verificar-ups', async () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    install(operatorUsWriteUser, { queue: { ready: [], unresolved: [order(5)], created: [], truncated: false } })
    renderAuthedPage(<LabelQueuePage />, '/operations/labels#verificar-ups', '/operations/labels')

    await screen.findByText('Cliente 5')
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1))
    expect(scrollIntoView.mock.instances[0]).toBe(document.getElementById('verificar-ups'))
    expect(document.getElementById('verificar-ups')).toHaveTextContent('Verificar na UPS')
  })

  it('Printing labels already created buys nothing, and a missing file is named', async () => {
    const user = userEvent.setup()
    const confirm = vi.fn()
    vi.stubGlobal('confirm', confirm)
    const { calls } = install({ ...readonlyUser, markets: ['US'] }, {
      queue: { ready: [order(1)], unresolved: [], created: [created(4), created(5), created(6)], truncated: false },
      missingLabels: ['106'],
    })
    render()

    expect(await screen.findByText('Cliente 1')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Selecionar Cliente 1' })).not.toBeInTheDocument()
    for (const n of [4, 5, 6]) await select(user, `Cliente ${n}`)
    await user.click(screen.getByRole('button', { name: 'Imprimir' }))

    await waitFor(() => expect(printLabels).toHaveBeenCalledTimes(1))
    expect(printLabels.mock.calls[0][0]).toHaveLength(2)
    expect(screen.getByTestId('outcome-in_6')).toHaveTextContent('Arquivo da etiqueta ausente')
    expect(purchases(calls)).toHaveLength(0)
    expect(confirm).not.toHaveBeenCalled()
  })

  it('Shipment with two boxes: fetches packages 1 and 2 and prints two pages, and the row shows its boxes', async () => {
    const user = userEvent.setup()
    const twoBoxes = order(7, {
      issues: undefined,
      shipment: {
        id: 107, status: 'created', tracking_number: '1Z7', has_label: true,
        packages: [
          { sequence: 1, box_key: 'monthly', pack_count: 30, weight_lb: 37.5, tracking_number: '1Z7A', has_label: true },
          { sequence: 2, box_key: 'monthly', pack_count: 15, weight_lb: 21, tracking_number: '1Z7B', has_label: true },
        ],
      },
    })
    const { calls } = install(operatorUsWriteUser, { queue: { ready: [], unresolved: [], created: [twoBoxes], truncated: false } })
    render()

    expect(await screen.findByText('2 caixas: mensal 30 · mensal 15')).toBeInTheDocument()
    await select(user, 'Cliente 7')
    await user.click(screen.getByRole('button', { name: 'Imprimir' }))

    await waitFor(() => expect(printLabels).toHaveBeenCalledTimes(1))
    expect(printLabels.mock.calls[0][0]).toHaveLength(2)
    const fetched = calls.filter((call) => call.path === '/api/v1/admin/shipments/107/label').map((call) => call.search)
    expect(fetched).toEqual(['?package=1', '?package=2'])
  })

  it('Label bought before boxes: fetches the label once, without package', async () => {
    const user = userEvent.setup()
    const { calls } = install(operatorUsWriteUser, { queue: { ready: [], unresolved: [], created: [created(8)], truncated: false } })
    render()

    await select(user, 'Cliente 8')
    await user.click(screen.getByRole('button', { name: 'Imprimir' }))

    await waitFor(() => expect(printLabels).toHaveBeenCalledTimes(1))
    expect(printLabels.mock.calls[0][0]).toHaveLength(1)
    expect(calls.filter((call) => call.path === '/api/v1/admin/shipments/108/label').map((call) => call.search)).toEqual([''])
    expect(screen.queryByText(/caixas:/)).not.toBeInTheDocument()
  })

  it('a ready row shows its address problem and the email state', async () => {
    install(operatorUsWriteUser, {
      queue: {
        ready: [order(1, { issues: [{ code: 'po_box_not_allowed' }], address_issue: { id: 3, codes: ['po_box_not_allowed'], source: 'ups_check', open: true, opened_at: new Date().toISOString(), email_sent_at: null, resolved_at: null, resolved_by: null } })],
        unresolved: [],
        created: [],
        truncated: false,
      },
    })
    render()

    const row = (await screen.findByText('Cliente 1')).closest('tr') as HTMLElement
    expect(within(row).getByText('E-mail não enviado')).toBeInTheDocument()
    expect(within(row).getByText(/PO Box/)).toBeInTheDocument()
  })

  it('blocked and unresolved orders cannot be selected and link to the subscription', async () => {
    install(operatorUsWriteUser, {
      queue: {
        ready: [order(1, { issues: [{ code: 'po_box_not_allowed' }] })],
        unresolved: [order(2, { issues: undefined, shipment: { id: 9, status: 'unknown', tracking_number: null, has_label: false } })],
        created: [],
        truncated: false,
      },
    })
    render()

    const blocked = (await screen.findByText('Cliente 1')).closest('tr') as HTMLElement
    expect(within(blocked).getByRole('note')).toHaveTextContent('PO Box')
    expect(within(blocked).getByRole('note')).toHaveTextContent('Meu Plano')
    expect(within(blocked).getByRole('note')).toHaveTextContent('WhatsApp')
    expect(within(blocked).queryByRole('checkbox')).toBeNull()
    const unresolved = screen.getByText('Cliente 2').closest('tr') as HTMLElement
    expect(within(unresolved).queryByRole('checkbox')).toBeNull()
    expect(within(unresolved).getByRole('link', { name: 'Assinatura' })).toHaveAttribute('href', '/billing/subscriptions/2')
    expect(screen.queryByRole('button', { name: /Anular/ })).toBeNull()
  })

  it('disables the button while the batch runs', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
    let release: () => void = () => {}
    printLabels.mockReset().mockImplementation(() => new Promise<void>((resolve) => { release = resolve }))
    install()
    render()

    await select(user, 'Cliente 1')
    await user.click(screen.getByRole('button', { name: 'Comprar e imprimir' }))

    await waitFor(() => expect(printLabels).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: /Comprar e imprimir|Imprimir/ })).toBeDisabled()
    release()
  })

  // admin-flow-fixes-5 (PM-29): ready orders by delivery range; created labels always show.
  it('reads the default range, lists a created label of a later day and says what comes later', async () => {
    const { calls } = install(operatorUsWriteUser, {
      queue: {
        ready: [order(1)],
        unresolved: [],
        created: [{ ...created(5), delivery_date: '2026-11-20' }],
        truncated: false,
        range: { from: '2026-10-07', to: '2026-11-07', default: true },
        later: 1,
        next_from: null,
      },
    })
    render()

    expect(await screen.findByText('Cliente 5')).toBeInTheDocument()
    expect(queueCalls(calls)[0].search).toBe('')
    expect(screen.getByText('Mais 1 pedido com entrega depois de 07/11.')).toBeInTheDocument()
  })

  it('sends the range of the URL and moves to the next cut of a full list', async () => {
    const { calls } = install(operatorUsWriteUser, {
      queue: { ready: [order(1)], unresolved: [], created: [], truncated: true, range: { from: '2026-11-01', to: '2026-11-20', default: false }, later: 0, next_from: '2026-11-09' },
    })
    render('/operations/labels?de=2026-11-01&ate=2026-11-20')

    await waitFor(() => expect(queueCalls(calls)[0]?.search).toBe('?from=2026-11-01&to=2026-11-20'))
    await userEvent.click(await screen.findByRole('button', { name: 'Ver a partir de 09/11' }))
    await waitFor(() => expect(queueCalls(calls).at(-1)?.search).toBe('?from=2026-11-09&to=2026-11-20'))
  })

  // admin-flow-fixes-5 (PM-26): the address filter applies to ready orders only.
  it('keeps the ready orders with an open address problem and every created label', async () => {
    install(operatorUsWriteUser, {
      queue: { ready: [order(1, { address_issue: addressIssue }), order(2)], unresolved: [], created: [created(5)], truncated: false },
    })
    render('/operations/labels?problema=endereco')

    expect(await screen.findByText('Cliente 1')).toBeInTheDocument()
    expect(screen.queryByText('Cliente 2')).not.toBeInTheDocument()
    expect(screen.getByText('Cliente 5')).toBeInTheDocument()
    expect(screen.getByText('Com problema de endereço')).toBeInTheDocument()
  })

  it('says the screen belongs to the Estados Unidos market and skips the list for a session outside it', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<LabelQueuePage />, '/operations/labels')

    expect(await screen.findByText(/Esta tela é do mercado Estados Unidos e sua conta não trabalha nele/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar para Hoje' })).toHaveAttribute('href', '/dashboard')
    expect(calls.some((call) => call.path === '/api/v1/admin/shipments/queue')).toBe(false)
  })
})

// admin-flow-fixes-6 (ups-pickup, PM-28 option B): the day's pickup is asked of UPS from the label queue.
describe('LabelQueuePage pickup', () => {
  const withPickup = (n: number, pickup: Record<string, unknown> | null) => ({ ...created(n), pickup })
  type PickupRoute = { status: number; body: unknown }

  function installPickup(user = operatorUsWriteUser, {
    createdItems = [created(1), created(2)].map((item) => ({ ...item, pickup: null })) as Array<Record<string, unknown>>,
    pickups = [] as Array<Record<string, unknown>>,
    post = { status: 200, body: { success: true, data: { pickup: { ...upsPickupRequested } } } } as PickupRoute,
    action = { status: 200, body: { success: true, data: {} } } as PickupRoute,
  } = {}) {
    return installAdminFetchMock(user, {
      upsPickups: pickups,
      routes: ({ path, method }) => {
        if (path === '/api/v1/admin/shipments/queue' && method === 'GET') {
          return json(200, { success: true, data: { ready: [], unresolved: [], created: createdItems, truncated: false } })
        }
        if (path === '/api/v1/admin/shipments/pickups' && method === 'POST') return json(post.status, post.body)
        if (/^\/api\/v1\/admin\/shipments\/pickups\/\d+\/(cancel|not-created)$/.test(path) && method === 'POST') return json(action.status, action.body)
        return undefined
      },
    })
  }

  const section = async () => within(await screen.findByRole('heading', { name: 'Coleta' }).then((heading) => heading.closest('section') as HTMLElement))
  const pickupPosts = (calls: Array<{ method: string; path: string; body?: unknown }>) => calls.filter((call) => call.method === 'POST' && call.path.startsWith('/api/v1/admin/shipments/pickups'))

  beforeEach(() => {
    seedAuth()
  })
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('Monday with eight boxes: the eight labels are selected and the count is 8', async () => {
    installPickup(operatorUsWriteUser, { createdItems: Array.from({ length: 8 }, (_, index) => withPickup(index + 1, null)) })
    render()

    const coleta = await section()
    await waitFor(() => expect(coleta.getAllByRole('checkbox', { name: /na coleta$/ })).toHaveLength(8))
    for (const box of coleta.getAllByRole('checkbox', { name: /na coleta$/ })) expect(box).toBeChecked()
    expect(coleta.getByRole('spinbutton', { name: 'Caixas' })).toHaveValue(8)
  })

  it('Requested: confirms, sends the body and shows the PRN', async () => {
    const user = userEvent.setup()
    const confirm = vi.fn().mockReturnValue(true)
    vi.stubGlobal('confirm', confirm)
    const { calls } = installPickup()
    render()

    const coleta = await section()
    await user.click(await coleta.findByRole('button', { name: 'Pedir coleta à UPS' }))

    expect(await coleta.findByText('Coleta pedida. PRN 2929602E9CP.')).toBeInTheDocument()
    expect(confirm.mock.calls[0][0]).toMatch(/^Pedir coleta à UPS para \d{2}\/\d{2}, das 14:00 às 18:00, com 2 caixas \(2 etiquetas\)\?$/)
    expect(pickupPosts(calls)[0].body).toEqual({
      pickup_date: todayIn(LABELS_TIMEZONE),
      ready_time: '14:00',
      close_time: '18:00',
      package_count: 2,
      shipment_ids: [101, 102],
    })
  })

  it('Two labels, three boxes: the count is 3 and the confirmation names boxes and labels', async () => {
    const user = userEvent.setup()
    const confirm = vi.fn().mockReturnValue(true)
    vi.stubGlobal('confirm', confirm)
    const pkg = (sequence: number) => ({ sequence, box_key: 'monthly', pack_count: 15, weight_lb: 21, tracking_number: `1Z${sequence}`, has_label: true })
    const twoBoxes = { ...created(1), pickup: null, shipment: { id: 101, status: 'created', tracking_number: '1Z1', has_label: true, packages: [pkg(1), pkg(2)] } }
    const { calls } = installPickup(operatorUsWriteUser, { createdItems: [twoBoxes, withPickup(2, null)] })
    render()

    const coleta = await section()
    await waitFor(() => expect(coleta.getByRole('spinbutton', { name: 'Caixas' })).toHaveValue(3))
    await user.click(coleta.getByRole('button', { name: 'Pedir coleta à UPS' }))

    expect(await coleta.findByText('Coleta pedida. PRN 2929602E9CP.')).toBeInTheDocument()
    expect(confirm.mock.calls[0][0]).toMatch(/com 3 caixas \(2 etiquetas\)\?$/)
    expect(pickupPosts(calls)[0].body).toMatchObject({ package_count: 3, shipment_ids: [101, 102] })
  })

  it('a count the operator typed does not follow the selection', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
    const { calls } = installPickup()
    render()

    const coleta = await section()
    const boxes = await coleta.findByRole('spinbutton', { name: 'Caixas' })
    await user.clear(boxes)
    await user.type(boxes, '1')
    await user.click(coleta.getByRole('checkbox', { name: 'Incluir Cliente 2 na coleta' }))
    expect(boxes).toHaveValue(1)
    await user.click(coleta.getByRole('checkbox', { name: 'Incluir Cliente 2 na coleta' }))
    await user.click(coleta.getByRole('button', { name: 'Pedir coleta à UPS' }))

    await waitFor(() => expect(pickupPosts(calls)).toHaveLength(1))
    expect(pickupPosts(calls)[0].body).toMatchObject({ package_count: 1, shipment_ids: [101, 102] })
  })

  it('Box already scanned: a label UPS read in transit is not listed', async () => {
    const scanned = { ...withPickup(2, null), shipment: { id: 102, status: 'created', tracking_number: '1Z2', has_label: true, in_transit_at: '2026-11-09T18:00:00Z' } }
    installPickup(operatorUsWriteUser, { createdItems: [withPickup(1, null), scanned] })
    render()

    const coleta = await section()
    await waitFor(() => expect(coleta.getAllByRole('checkbox', { name: /na coleta$/ })).toHaveLength(1))
    expect(coleta.queryByRole('checkbox', { name: 'Incluir Cliente 2 na coleta' })).not.toBeInTheDocument()
  })

  it('Fewer boxes than labels: the confirmation says both', async () => {
    const user = userEvent.setup()
    const confirm = vi.fn().mockReturnValue(false)
    vi.stubGlobal('confirm', confirm)
    installPickup(operatorUsWriteUser, { createdItems: Array.from({ length: 15 }, (_, index) => withPickup(index + 1, null)) })
    render()

    const coleta = await section()
    const boxes = await coleta.findByRole('spinbutton', { name: 'Caixas' })
    await waitFor(() => expect(boxes).toHaveValue(15))
    await user.clear(boxes)
    await user.type(boxes, '14')
    await user.click(coleta.getByRole('button', { name: 'Pedir coleta à UPS' }))

    expect(confirm.mock.calls[0][0]).toContain('com 14 caixas (15 etiquetas)')
  })

  it('A pickup in progress shows "Pedindo à UPS" without actions', async () => {
    installPickup(operatorUsWriteUser, { pickups: [{ ...upsPickupRequested, status: 'pending', prn: null }] })
    render()

    const coleta = await section()
    expect(await coleta.findByText('Pedindo à UPS')).toBeInTheDocument()
    expect(coleta.queryByRole('button', { name: 'Cancelar coleta' })).not.toBeInTheDocument()
    expect(coleta.queryByRole('button', { name: 'Não foi criada' })).not.toBeInTheDocument()
  })

  it('Nothing to collect', async () => {
    installPickup(operatorUsWriteUser, { createdItems: [withPickup(1, { id: 31, pickup_date: '2026-11-09', status: 'requested', prn: 'X' })] })
    render()

    const coleta = await section()
    expect(await coleta.findByText('Nenhuma etiqueta sem coleta.')).toBeInTheDocument()
    expect(coleta.queryByRole('button', { name: 'Pedir coleta à UPS' })).not.toBeInTheDocument()
  })

  it('Read-only staff see the labels and pickups without the form or the actions', async () => {
    installPickup({ ...readonlyUser, markets: ['US'] }, { pickups: [upsPickupRequested] })
    render()

    const coleta = await section()
    expect(await coleta.findByText('Cliente 1 · 1Z1')).toBeInTheDocument()
    expect(await coleta.findByText('2929602E9CP')).toBeInTheDocument()
    expect(coleta.queryByRole('button', { name: 'Pedir coleta à UPS' })).not.toBeInTheDocument()
    expect(coleta.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(coleta.queryByRole('button', { name: 'Cancelar coleta' })).not.toBeInTheDocument()
  })

  it('Phone missing: says what UPS needs and links to the shipping settings', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
    installPickup(operatorUsWriteUser, { post: { status: 422, body: { message: 'No.', details: { code: 'pickup_ship_from_incomplete', missing: ['phone'] } } } })
    render()

    const coleta = await section()
    await user.click(await coleta.findByRole('button', { name: 'Pedir coleta à UPS' }))

    expect(await coleta.findByText(/O telefone da sede dos EUA está faltando ou curto/)).toBeInTheDocument()
    expect(coleta.getByRole('link', { name: 'Abrir Regras de frete' })).toHaveAttribute('href', '/config/shipping?aba=sede&mercado=us')
  })

  it('No UPS answer: shows the text and reloads', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
    const { calls } = installPickup(operatorUsWriteUser, { post: { status: 502, body: { message: 'No.', details: { code: 'pickup_unconfirmed', pickup_id: 31 } } } })
    render()

    const coleta = await section()
    await user.click(await coleta.findByRole('button', { name: 'Pedir coleta à UPS' }))

    expect(await coleta.findByText('A UPS não confirmou a coleta. Confira no portal da UPS antes de pedir de novo.')).toBeInTheDocument()
    await waitFor(() => expect(queueCalls(calls)).toHaveLength(2))
    expect(calls.filter((call) => call.method === 'GET' && call.path === '/api/v1/admin/shipments/pickups').length).toBeGreaterThanOrEqual(2)
  })

  it('Cancel: confirms and calls the cancel route', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
    const { calls } = installPickup(operatorUsWriteUser, { pickups: [upsPickupRequested] })
    render()

    const coleta = await section()
    await user.click(await coleta.findByRole('button', { name: 'Cancelar coleta' }))

    await waitFor(() => expect(pickupPosts(calls).map((call) => call.path)).toEqual(['/api/v1/admin/shipments/pickups/31/cancel']))
    expect(await coleta.findByText('Coleta cancelada na UPS.')).toBeInTheDocument()
  })

  it('Checked on the portal: an unknown pickup closes as not created', async () => {
    const user = userEvent.setup()
    const confirm = vi.fn().mockReturnValue(true)
    vi.stubGlobal('confirm', confirm)
    const { calls } = installPickup(operatorUsWriteUser, { pickups: [{ ...upsPickupRequested, status: 'unknown', prn: null }] })
    render()

    const coleta = await section()
    expect(await coleta.findByText('Verificar no portal da UPS')).toBeInTheDocument()
    expect(coleta.queryByRole('button', { name: 'Cancelar coleta' })).not.toBeInTheDocument()
    await user.click(coleta.getByRole('button', { name: 'Não foi criada' }))

    expect(confirm.mock.calls[0][0]).toMatch(/Confira no portal da UPS/)
    await waitFor(() => expect(pickupPosts(calls).map((call) => call.path)).toEqual(['/api/v1/admin/shipments/pickups/31/not-created']))
  })

  it('A created label shows its pickup or "Sem coleta"', async () => {
    installPickup(operatorUsWriteUser, {
      createdItems: [
        withPickup(1, { id: 31, pickup_date: '2026-11-09', status: 'requested', prn: '2929602E9CP' }),
        withPickup(2, null),
      ],
    })
    render()

    expect(await screen.findByText('Coleta pedida para 09/11 · PRN 2929602E9CP')).toBeInTheDocument()
    expect(screen.getByText('Sem coleta')).toBeInTheDocument()
  })
})
