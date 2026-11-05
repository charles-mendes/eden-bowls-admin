import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CourierDeliveriesPage } from './CourierDeliveriesPage'
import { operatorWriteUser, readonlyUser, operatorUsUser } from '../test/fixtures'
import { installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const item = (n: number, extra: Record<string, unknown> = {}) => ({
  subscription_id: String(n),
  stripe_subscription_id: `sub_${n}`,
  invoice_id: `in_${n}`,
  recipient_name: `Cliente ${n}`,
  neighborhood: 'Pinheiros',
  city: 'São Paulo',
  zipcode: '05422-000',
  delivery_date: '2026-11-05',
  production_status: 'ready',
  subscription_status: 'active',
  delivery: null,
  ...extra,
})
const delivery = (id: number, status: string, extra: Record<string, unknown> = {}) => ({
  id, subscription_id: '9', stripe_invoice_id: 'in_9', method: 'uber', courier_name: 'Carlos', tracking_url: 'https://trip.uber.com/abc',
  cost_minor: 1850, currency: 'brl', note: null, status, out_for_delivery_at: '2026-11-04T12:00:00.000Z', delivered_at: null,
  failed_at: null, failure_reason: null, canceled_at: null, ...extra,
})

type Queue = Record<'to_dispatch' | 'out_for_delivery' | 'failed' | 'delivered', unknown[]> & { truncated: boolean }
type Reply = { status: number; body: unknown }

function install(user = operatorWriteUser, { queue, dispatch = [], actions = {} }: { queue?: Queue; dispatch?: Reply[]; actions?: Record<string, Reply> } = {}) {
  const data: Queue = queue ?? {
    to_dispatch: [item(1)],
    out_for_delivery: [item(9, { delivery: delivery(5, 'out_for_delivery') })],
    failed: [],
    delivered: [],
    truncated: false,
  }
  const replies = [...dispatch]
  return installAdminFetchMock(user, {
    routes: ({ path, method }: { path: string; method: string }) => {
      if (path === '/api/v1/admin/courier-deliveries/queue' && method === 'GET') return json(200, { success: true, data })
      if (/^\/api\/v1\/admin\/billing\/subscriptions\/[^/]+\/courier-deliveries$/.test(path) && method === 'POST') {
        const reply = replies.shift() ?? { status: 200, body: { success: true, data: { delivery: delivery(6, 'out_for_delivery') } } }
        return json(reply.status, reply.body)
      }
      const action = path.match(/^\/api\/v1\/admin\/courier-deliveries\/(\d+)\/(delivered|failed|cancel)$/)
      if (action && method === 'POST') {
        const reply = actions[action[2]] ?? { status: 200, body: { success: true, data: { delivery: delivery(Number(action[1]), action[2]) } } }
        return json(reply.status, reply.body)
      }
      return undefined
    },
  })
}

const render = () => renderAuthedPage(<CourierDeliveriesPage />, '/operations/courier', '/operations/courier')
const posts = (calls: Array<{ method: string; path: string; body?: unknown }>, suffix: string) => calls.filter((call) => call.method === 'POST' && call.path.endsWith(suffix))

describe('CourierDeliveriesPage', () => {
  beforeEach(() => {
    seedAuth()
  })
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('dispatches an order with method, link and cost', async () => {
    const user = userEvent.setup()
    const { calls } = install()
    render()

    await user.click(await screen.findByRole('button', { name: 'Despachar' }))
    const dialog = await screen.findByRole('dialog', { name: 'Despachar entrega' })
    await user.selectOptions(within(dialog).getByLabelText('Meio de entrega'), 'motoboy')
    await user.type(within(dialog).getByLabelText('Link de acompanhamento'), 'https://trip.uber.com/xyz')
    await user.type(within(dialog).getByLabelText('Custo (R$)'), '18,50')
    await user.click(screen.getByRole('button', { name: 'Registrar saída' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Entrega de Cliente 1 registrada como em rota.')
    const [call] = posts(calls, '/1/courier-deliveries')
    expect(call.body).toEqual({ invoice_id: 'in_1', method: 'motoboy', tracking_url: 'https://trip.uber.com/xyz', cost: '18.50' })
  })

  it('asks again when the order is not ready, naming the reason, then sends the confirmation', async () => {
    const user = userEvent.setup()
    const { calls } = install(operatorWriteUser, {
      dispatch: [{
        status: 409,
        body: { message: 'Not ready', code: 'courier_dispatch_needs_confirmation', details: { code: 'courier_dispatch_needs_confirmation', reasons: [{ code: 'production_not_ready', production_status: 'in_production' }] } },
      }],
    })
    render()

    await user.click(await screen.findByRole('button', { name: 'Despachar' }))
    await user.click(await screen.findByRole('button', { name: 'Registrar saída' }))

    const warning = await screen.findByRole('alert', { name: 'Confirmação de despacho' })
    expect(warning).toHaveTextContent('Preparo:')
    await user.click(screen.getByRole('button', { name: 'Despachar mesmo assim' }))

    await waitFor(() => expect(posts(calls, '/1/courier-deliveries')).toHaveLength(2))
    expect(posts(calls, '/1/courier-deliveries')[1].body).toMatchObject({ confirm_not_ready: true })
  })

  it('marks a delivery failed with a reason', async () => {
    const user = userEvent.setup()
    const { calls } = install()
    render()

    await user.click(await screen.findByRole('tab', { name: /Em rota/ }))
    await user.click(await screen.findByRole('button', { name: 'Falhou' }))
    const dialog = await screen.findByRole('dialog', { name: 'Registrar falha na entrega' })
    expect(within(dialog.parentElement as HTMLElement).getByRole('button', { name: 'Registrar falha' })).toBeDisabled()
    await user.type(within(dialog).getByLabelText('Motivo'), 'Ninguém em casa')
    await user.click(screen.getByRole('button', { name: 'Registrar falha' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Falha registrada')
    expect(posts(calls, '/5/failed')[0].body).toEqual({ reason: 'Ninguém em casa' })
  })

  it('explains a 409 courier_delivery_final and reloads the queue', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
    const { calls } = install(operatorWriteUser, {
      actions: { delivered: { status: 409, body: { message: 'closed', code: 'courier_delivery_final', details: { code: 'courier_delivery_final' } } } },
    })
    render()

    await user.click(await screen.findByRole('tab', { name: /Em rota/ }))
    await user.click(await screen.findByRole('button', { name: 'Entregue' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('já foi encerrada por outra pessoa')
    await waitFor(() => expect(calls.filter((call) => call.path.endsWith('/courier-deliveries/queue'))).toHaveLength(2))
  })

  it('shows the queue read-only without shipping.write', async () => {
    const user = userEvent.setup()
    install(readonlyUser)
    render()

    expect(await screen.findByText('Cliente 1')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Despachar' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /Em rota/ }))
    expect(await screen.findByText('Cliente 9')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Entregue' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Acompanhar' })).toHaveAttribute('href', 'https://trip.uber.com/abc')
  })

  it('opens the tab named in the URL and falls back to A despachar', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<CourierDeliveriesPage />, '/operations/courier?aba=falhas', '/operations/courier')
    expect(await screen.findByRole('tab', { name: /Falhas/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('selects A despachar for an unknown tab', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<CourierDeliveriesPage />, '/operations/courier?aba=xyz', '/operations/courier')
    expect(await screen.findByRole('tab', { name: /A despachar/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('says the screen belongs to the Brasil market and skips the list for a session outside it', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(operatorUsUser)
    renderAuthedPage(<CourierDeliveriesPage />, '/operations/courier')

    expect(await screen.findByText(/Esta tela é do mercado Brasil e sua conta não trabalha nele/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar para Hoje' })).toHaveAttribute('href', '/dashboard')
    expect(calls.some((call) => call.path === '/api/v1/admin/courier-deliveries/queue')).toBe(false)
  })
})
