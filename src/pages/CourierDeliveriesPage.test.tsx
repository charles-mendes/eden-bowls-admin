import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CourierDeliveriesPage } from './CourierDeliveriesPage'
import { addressIssue, operatorWriteUser, readonlyUser, operatorUsUser } from '../test/fixtures'
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

  it('a row with an address problem says what is missing, offers no Despachar and shows the email state', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-07T15:00:00Z'))
    install(operatorWriteUser, {
      queue: {
        to_dispatch: [item(1, { issues: ['address_number_missing'], address_issue: { ...addressIssue, codes: ['address_number_missing'] } }), item(2)],
        out_for_delivery: [],
        failed: [],
        delivered: [],
        truncated: false,
      },
    })
    render()

    const row = (await screen.findByText('Cliente 1')).closest('tr') as HTMLElement
    expect(within(row).getByText('Falta o número')).toBeInTheDocument()
    expect(within(row).queryByRole('button', { name: 'Despachar' })).not.toBeInTheDocument()
    expect(within(row).getByText('E-mail enviado em 03/11')).toBeInTheDocument()
    expect(within(row).getByText('Sem correção há 4 dias')).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Registrar contato' })).toBeInTheDocument()
    const other = screen.getByText('Cliente 2').closest('tr') as HTMLElement
    expect(within(other).getByRole('button', { name: 'Despachar' })).toBeInTheDocument()
    vi.useRealTimers()
  })

  it.each([
    [{ code: 'courier_address_incomplete', details: { code: 'courier_address_incomplete', issues: ['address_neighborhood_missing'] } }, 'O endereço não serve para a entrega: falta o bairro. Nada foi despachado.'],
    [{ code: 'shipment_market_exception', details: { code: 'shipment_market_exception' } }, 'Conta e país do endereço não combinam'],
  ])('explains a dispatch refused by the API (%#)', async (body, text) => {
    const user = userEvent.setup()
    const { calls } = install(operatorWriteUser, { dispatch: [{ status: 422, body: { message: 'Refused', ...body } }] })
    render()

    await user.click(await screen.findByRole('button', { name: 'Despachar' }))
    await user.click(await screen.findByRole('button', { name: 'Registrar saída' }))
    const dialog = await screen.findByRole('dialog', { name: 'Despachar entrega' })
    expect(await within(dialog).findByText(new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeInTheDocument()
    expect(posts(calls, '/courier-deliveries')).toHaveLength(1)
  })

  it('marks a delivery failed with a kind and a reason, both required', async () => {
    const user = userEvent.setup()
    const { calls } = install()
    render()

    await user.click(await screen.findByRole('tab', { name: /Em rota/ }))
    await user.click(await screen.findByRole('button', { name: 'Falhou' }))
    const dialog = await screen.findByRole('dialog', { name: 'Registrar falha na entrega' })
    const save = within(dialog).getByRole('button', { name: 'Registrar falha' })
    expect(save).toBeDisabled()
    await user.type(within(dialog).getByLabelText('Motivo'), 'Portaria não aceita')
    expect(save).toBeDisabled()
    await user.click(within(dialog).getByLabelText('Endereço não serve'))
    await user.click(save)

    expect(await screen.findByRole('status')).toHaveTextContent('Falha registrada')
    expect(posts(calls, '/5/failed')[0].body).toEqual({ reason: 'Portaria não aceita', failure_kind: 'address_unusable' })
  })

  it('shows the failure kind on the Falhas row and records a contact preset to delivery failure', async () => {
    const user = userEvent.setup()
    install(operatorWriteUser, {
      queue: {
        to_dispatch: [],
        out_for_delivery: [],
        failed: [item(9, { phone: '+55 11 98888-7777', delivery: delivery(5, 'failed', { failure_kind: 'customer_absent', failure_reason: 'Ninguém em casa', failed_at: '2026-11-04T15:00:00.000Z' }) })],
        delivered: [],
        truncated: false,
      },
    })
    renderAuthedPage(<CourierDeliveriesPage />, '/operations/courier?aba=falhas', '/operations/courier')

    expect(await screen.findByText('Cliente ausente')).toBeInTheDocument()
    expect(screen.getByText('Motivo: Ninguém em casa')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Registrar contato' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Registrar contato' }))
    expect(dialog.getByLabelText('Motivo')).toHaveValue('delivery_failed')
    expect(dialog.getByText('+55 11 98888-7777')).toBeInTheDocument()
  })

  it('offers Registrar contato on the road, with no preset reason', async () => {
    const user = userEvent.setup()
    install()
    render()

    await user.click(await screen.findByRole('tab', { name: /Em rota/ }))
    await user.click(await screen.findByRole('button', { name: 'Registrar contato' }))
    expect(within(screen.getByRole('dialog', { name: 'Registrar contato' })).getByLabelText('Motivo')).toHaveValue('')
  })

  const fullItem = (n: number, extra: Record<string, unknown> = {}) => item(n, {
    address: { street: 'Rua dos Pinheiros', number: '100', complement: 'Apto 12', neighborhood: 'Pinheiros', city: 'São Paulo', state: 'SP', zipcode: '05422-000' },
    phone: '+55 11 97777-0000',
    delivery_instructions: 'Deixar na portaria',
    delivery_instructions_source: 'profile',
    items: [{ flavor: 'Frango', quantity: 2, pack_size: '500 g' }, { flavor: 'Carne', quantity: 1, pack_size: '500 g' }],
    ...extra,
  })

  it('shows what the courier needs on the row and copies the address', async () => {
    const user = userEvent.setup()
    install(operatorWriteUser, { queue: { to_dispatch: [fullItem(1)], out_for_delivery: [], failed: [], delivered: [], truncated: false } })
    render()

    expect(await screen.findByText('+55 11 97777-0000')).toBeInTheDocument()
    expect(screen.getByText('Instruções (do perfil): Deixar na portaria')).toBeInTheDocument()
    expect(screen.getByText('Frango 2 × 500 g · Carne 1 × 500 g')).toBeInTheDocument()
    const address = 'Rua dos Pinheiros, 100\nApto 12\nPinheiros\nSão Paulo/SP\n05422-000'
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
    await user.click(screen.getByRole('button', { name: 'Copiar endereço de Cliente 1' }))
    expect(writeText).toHaveBeenCalledWith(address)
    expect(await screen.findByText('Copiado')).toBeInTheDocument()
  })

  it('says when the phone and the instructions are missing', async () => {
    install(operatorWriteUser, { queue: { to_dispatch: [fullItem(1, { phone: null, delivery_instructions: null })], out_for_delivery: [], failed: [], delivered: [], truncated: false } })
    render()

    expect(await screen.findByText('Sem telefone')).toBeInTheDocument()
    expect(screen.getByText('Sem instruções')).toBeInTheDocument()
  })

  it('explains the link field and keeps Uber preselected', async () => {
    const user = userEvent.setup()
    install()
    render()

    await user.click(await screen.findByRole('button', { name: 'Despachar' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Despachar entrega' }))
    expect(dialog.getByLabelText('Meio de entrega')).toHaveValue('uber')
    expect(dialog.getByLabelText('Link de acompanhamento')).toHaveAccessibleDescription(/link de acompanhamento que o app/)
  })

  it('edits a delivery on the road with its saved details, one delivery at a time', async () => {
    const user = userEvent.setup()
    const patches: Array<{ path: string; body: unknown }> = []
    const queue = {
      to_dispatch: [],
      out_for_delivery: [
        item(9, { delivery: delivery(5, 'out_for_delivery', { method: 'uber', tracking_url: 'https://trip.uber.com/abc', cost_minor: 1850, note: 'Portão azul' }) }),
        item(10, { invoice_id: 'in_10', delivery: delivery(6, 'out_for_delivery', { method: 'motoboy', courier_name: 'Zé', tracking_url: null, cost_minor: 1200, note: null }) }),
      ],
      failed: [],
      delivered: [],
      truncated: false,
    }
    installAdminFetchMock(operatorWriteUser, {
      routes: ({ path, method, body }) => {
        if (path === '/api/v1/admin/courier-deliveries/queue' && method === 'GET') return json(200, { success: true, data: queue })
        if (/^\/api\/v1\/admin\/courier-deliveries\/\d+$/.test(path) && method === 'PATCH') {
          patches.push({ path, body })
          return json(200, { success: true, data: { delivery: delivery(5, 'out_for_delivery') } })
        }
        return undefined
      },
    })
    renderAuthedPage(<CourierDeliveriesPage />, '/operations/courier?aba=em_rota', '/operations/courier')

    const rows = await screen.findAllByRole('button', { name: 'Editar' })
    await user.click(rows[0])
    let dialog = within(await screen.findByRole('dialog', { name: 'Editar entrega' }))
    expect(dialog.getByLabelText('Meio de entrega')).toHaveValue('uber')
    expect(dialog.getByLabelText('Link de acompanhamento')).toHaveValue('https://trip.uber.com/abc')
    expect(dialog.getByLabelText('Custo (R$)')).toHaveValue('18,50')
    expect(dialog.getByLabelText('Observação')).toHaveValue('Portão azul')
    await user.click(dialog.getByRole('button', { name: 'Fechar' }))

    await user.click(rows[1])
    dialog = within(await screen.findByRole('dialog', { name: 'Editar entrega' }))
    expect(dialog.getByLabelText('Meio de entrega')).toHaveValue('motoboy')
    expect(dialog.getByLabelText('Entregador')).toHaveValue('Zé')
    expect(dialog.getByLabelText('Link de acompanhamento')).toHaveValue('')
    expect(dialog.getByLabelText('Custo (R$)')).toHaveValue('12,00')
    await user.click(dialog.getByRole('button', { name: 'Fechar' }))

    await user.click(rows[0])
    dialog = within(await screen.findByRole('dialog', { name: 'Editar entrega' }))
    const link = dialog.getByLabelText('Link de acompanhamento')
    await user.clear(link)
    await user.type(link, 'https://trip.uber.com/certo')
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Entrega de Cliente 9 atualizada.')
    expect(patches).toHaveLength(1)
    expect(patches[0].path).toBe('/api/v1/admin/courier-deliveries/5')
    expect(patches[0].body).toMatchObject({ method: 'uber', tracking_url: 'https://trip.uber.com/certo', cost: '18.50', note: 'Portão azul' })
    expect(patches[0].body).not.toHaveProperty('confirm_not_ready')
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
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar contato' })).not.toBeInTheDocument()
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
