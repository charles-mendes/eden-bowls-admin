import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CourierDeliveriesPage } from './CourierDeliveriesPage'
import { addressIssue, operatorWriteUser, readonlyUser, operatorUsUser } from '../test/fixtures'
import { installAdminFetchMock } from '../test/mockAdminFetch'
import { COURIER_TIMEZONE, nextSevenDays } from '../lib/deliveryRange'
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

type Queue = Record<'to_dispatch' | 'out_for_delivery' | 'failed' | 'delivered', unknown[]> & { truncated: boolean; nfe_required?: boolean; range?: { from: string; to: string; default: boolean }; later?: number; next_from?: string | null }
type Reply = { status: number; body: unknown }

function install(user = operatorWriteUser, { queue, dispatch = [], actions = {}, rangeError = false }: { queue?: Queue; dispatch?: Reply[]; actions?: Record<string, Reply>; rangeError?: boolean } = {}) {
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
      if (path === '/api/v1/admin/courier-deliveries/queue' && method === 'GET') {
        if (rangeError) return json(400, { success: false, message: 'Bad range', details: { code: 'invalid_delivery_range' } })
        return json(200, { success: true, data })
      }
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

const render = (route = '/operations/courier') => renderAuthedPage(<CourierDeliveriesPage />, route, '/operations/courier')
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
    await user.click(within(dialog).getByText('Detalhes'))
    await user.type(within(dialog).getByLabelText('Link de acompanhamento (Opcional)'), 'https://trip.uber.com/xyz')
    await user.type(within(dialog).getByLabelText('Custo do entregador (R$) (Opcional)'), '18,50')
    await user.click(screen.getByRole('button', { name: 'Registrar saída' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Entrega de Cliente 1 registrada como em rota.')
    const [call] = posts(calls, '/1/courier-deliveries')
    expect(call.body).toEqual({ invoice_id: 'in_1', method: 'motoboy', tracking_url: 'https://trip.uber.com/xyz', cost: '18.50' })
  })

  it('shows the freight the customer paid apart from the empty courier cost', async () => {
    const user = userEvent.setup()
    install(operatorWriteUser, {
      queue: {
        to_dispatch: [item(1, { customer_shipping: { label: 'Entrega Eden Bowl', amount: 18.5, currency: 'BRL', distance_km: 12.4 } })],
        out_for_delivery: [],
        failed: [],
        delivered: [],
        truncated: false,
      },
    })
    render()

    await user.click(await screen.findByRole('button', { name: 'Despachar' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Despachar entrega' }))
    const summary = dialog.getByRole('region', { name: 'Frete cobrado do cliente' })
    expect(summary).toHaveTextContent(/R\$\s18,50/)
    expect(summary).toHaveTextContent('12,4 km')
    expect(summary).toHaveTextContent('Entrega Eden Bowl')
    expect(summary).toHaveTextContent('Este valor já foi cobrado no checkout. Despachar não altera o que o cliente paga.')
    const cost = dialog.getByLabelText('Custo do entregador (R$) (Opcional)')
    expect(cost).toHaveValue('')
    expect(cost).not.toHaveAttribute('placeholder')
    expect(cost).toHaveAccessibleDescription('O que a Eden Bowls paga nesta viagem (Uber, motoboy ou entregador). Opcional. Não entra na cobrança do cliente.')
  })

  it('marks the courier and the link as optional, and dispatches with neither', async () => {
    const user = userEvent.setup()
    const { calls } = install()
    render()

    await user.click(await screen.findByRole('button', { name: 'Despachar' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Despachar entrega' }))
    await user.selectOptions(dialog.getByLabelText('Meio de entrega'), 'motoboy')
    expect(dialog.getByLabelText('Entregador (Opcional)')).toHaveValue('')
    expect(dialog.getByLabelText('Link de acompanhamento (Opcional)')).toHaveValue('')
    await user.click(dialog.getByRole('button', { name: 'Registrar saída' }))

    await waitFor(() => expect(posts(calls, '/1/courier-deliveries')[0]?.body).toEqual({ invoice_id: 'in_1', method: 'motoboy' }))
  })

  it('shows the cost and link help behind an info icon, and Escape closes only the tip', async () => {
    const user = userEvent.setup()
    install()
    render()

    await user.click(await screen.findByRole('button', { name: 'Despachar' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Despachar entrega' }))
    const costHelp = 'O que a Eden Bowls paga nesta viagem (Uber, motoboy ou entregador). Opcional. Não entra na cobrança do cliente.'
    expect(dialog.queryByText(costHelp)).not.toBeVisible()
    await user.click(dialog.getByRole('button', { name: 'Sobre o custo do entregador' }))
    expect(dialog.getByRole('tooltip')).toHaveTextContent(costHelp)
    await user.keyboard('{Escape}')
    expect(dialog.queryByRole('tooltip')).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Despachar entrega' })).toBeInTheDocument()

    await user.selectOptions(dialog.getByLabelText('Meio de entrega'), 'motoboy')
    await user.click(dialog.getByRole('button', { name: 'Sobre o link de acompanhamento' }))
    expect(dialog.getByRole('tooltip')).toHaveTextContent('O link de acompanhamento que o app (Uber ou outro) gera para compartilhar a viagem.')
  })

  it('says the freight was not recorded when the queue row has no snapshot', async () => {
    const user = userEvent.setup()
    install()
    render()

    await user.click(await screen.findByRole('button', { name: 'Despachar' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Despachar entrega' }))
    expect(dialog.getByRole('region', { name: 'Frete cobrado do cliente' })).toHaveTextContent('Não registrado no checkout')
    expect(dialog.getByLabelText('Custo do entregador (R$) (Opcional)')).toHaveValue('')
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
    // The customer freight stays on screen above the reasons.
    const summary = screen.getByRole('region', { name: 'Frete cobrado do cliente' })
    expect(summary.compareDocumentPosition(warning) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Despachar mesmo assim' }))

    await waitFor(() => expect(posts(calls, '/1/courier-deliveries')).toHaveLength(2))
    expect(posts(calls, '/1/courier-deliveries')[1].body).toMatchObject({ confirm_not_ready: true })
  })

  // explain-hold-reason-and-overdue: the title names the one reason; several get the generic title.
  it.each([
    ['a canceled subscription', [{ code: 'subscription_not_active', subscription_status: 'canceled' }], 'Assinatura cancelada', ['Assinatura: Cancelada']],
    ['an order still in the kitchen', [{ code: 'production_not_ready', production_status: 'in_production' }], 'Pedido ainda não está pronto', ['Preparo: Em preparo']],
    ['two reasons', [{ code: 'production_not_ready', production_status: 'in_production' }, { code: 'subscription_not_active', subscription_status: 'canceled' }], 'Confirme antes de despachar', ['Preparo: Em preparo', 'Assinatura: Cancelada']],
  ])('titles the dispatch confirmation by its reason: %s', async (_case, reasons, title, lines) => {
    const user = userEvent.setup()
    install(operatorWriteUser, {
      dispatch: [{
        status: 409,
        body: { message: 'Not ready', code: 'courier_dispatch_needs_confirmation', details: { code: 'courier_dispatch_needs_confirmation', reasons } },
      }],
    })
    render()

    await user.click(await screen.findByRole('button', { name: 'Despachar' }))
    await user.click(await screen.findByRole('button', { name: 'Registrar saída' }))

    expect(await screen.findByRole('dialog', { name: title })).toBeInTheDocument()
    const warning = screen.getByRole('alert', { name: 'Confirmação de despacho' })
    lines.forEach((line) => expect(warning).toHaveTextContent(line))
    expect(screen.getByRole('button', { name: 'Despachar mesmo assim' })).toBeInTheDocument()
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

  it('Two-box delivery: the row shows "2 caixas", and a row without boxes shows nothing extra', async () => {
    const boxes = [
      { key: 'monthly', label: 'Caixa mensal', pack_count: 30, weight_kg: 16.5 },
      { key: 'starter', label: 'Starter Box', pack_count: 4, weight_kg: 3 },
    ]
    install(operatorWriteUser, { queue: { to_dispatch: [fullItem(1, { boxes }), fullItem(2)], out_for_delivery: [], failed: [], delivered: [], truncated: false } })
    render()

    expect(await screen.findByText('2 caixas')).toBeInTheDocument()
    expect(screen.queryByText(/^\d+ caixas?$/, { selector: 'span' })).toHaveTextContent('2 caixas')
    expect(screen.queryAllByText(/^\d+ caixas?$/)).toHaveLength(1)
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
    await user.click(dialog.getByText('Detalhes'))
    expect(dialog.getByLabelText('Link de acompanhamento (Opcional)')).toHaveAccessibleDescription(/link de acompanhamento que o app/)
  })

  // simplify-brazil-dispatch: the short Uber form.
  it('asks a new Uber dispatch for the cost only, keeps the rest behind Detalhes, and sends no hidden field', async () => {
    const user = userEvent.setup()
    const { calls } = install()
    render()

    await user.click(await screen.findByRole('button', { name: 'Despachar' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Despachar entrega' }))
    const details = dialog.getByText('Detalhes').closest('details') as HTMLDetailsElement
    expect(details.open).toBe(false)
    expect(details).not.toContainElement(dialog.getByLabelText('Custo do entregador (R$) (Opcional)'))
    for (const label of ['Entregador (Opcional)', 'Link de acompanhamento (Opcional)', 'Observação (Opcional)']) expect(details).toContainElement(dialog.getByLabelText(label))

    await user.type(dialog.getByLabelText('Custo do entregador (R$) (Opcional)'), '21,90')
    await user.click(screen.getByRole('button', { name: 'Registrar saída' }))

    await screen.findByRole('status')
    expect(posts(calls, '/1/courier-deliveries')[0].body).toEqual({ invoice_id: 'in_1', method: 'uber', cost: '21.90' })
  })

  it('keeps the short form for every method: the cost in sight, the rest behind "Detalhes"', async () => {
    const user = userEvent.setup()
    install()
    render()

    await user.click(await screen.findByRole('button', { name: 'Despachar' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Despachar entrega' }))
    for (const method of ['uber', 'motoboy', 'own_driver', 'other']) {
      await user.selectOptions(dialog.getByLabelText('Meio de entrega'), method)
      const details = dialog.getByText('Detalhes').closest('details') as HTMLDetailsElement
      expect(details.open).toBe(false)
      expect(dialog.getByLabelText('Custo do entregador (R$) (Opcional)')).toBeVisible()
      expect(details).not.toContainElement(dialog.getByLabelText('Custo do entregador (R$) (Opcional)'))
      for (const label of ['Entregador (Opcional)', 'Link de acompanhamento (Opcional)', 'Observação (Opcional)']) expect(details).toContainElement(dialog.getByLabelText(label))
    }
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
    // An edit never uses the short form, Uber included.
    expect(dialog.queryByText('Detalhes')).not.toBeInTheDocument()
    expect(dialog.getByLabelText('Link de acompanhamento (Opcional)')).toHaveValue('https://trip.uber.com/abc')
    expect(dialog.getByLabelText('Custo do entregador (R$) (Opcional)')).toHaveValue('18,50')
    expect(dialog.getByLabelText('Observação (Opcional)')).toHaveValue('Portão azul')
    await user.click(dialog.getByRole('button', { name: 'Fechar' }))

    await user.click(rows[1])
    dialog = within(await screen.findByRole('dialog', { name: 'Editar entrega' }))
    expect(dialog.getByLabelText('Meio de entrega')).toHaveValue('motoboy')
    expect(dialog.getByLabelText('Entregador (Opcional)')).toHaveValue('Zé')
    expect(dialog.getByLabelText('Link de acompanhamento (Opcional)')).toHaveValue('')
    expect(dialog.getByLabelText('Custo do entregador (R$) (Opcional)')).toHaveValue('12,00')
    await user.click(dialog.getByRole('button', { name: 'Fechar' }))

    await user.click(rows[0])
    dialog = within(await screen.findByRole('dialog', { name: 'Editar entrega' }))
    const link = dialog.getByLabelText('Link de acompanhamento (Opcional)')
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

  // admin-flow-fixes-4 (PM-25): with the fiscal lock on, the box leaves only with an authorized NF-e.
  const withNfe = (nfeRequired: boolean, toDispatch: unknown[], failed: unknown[] = []): Queue => ({
    to_dispatch: toDispatch, out_for_delivery: [], failed, delivered: [], truncated: false, nfe_required: nfeRequired,
  })

  it('dispatches a row whose NF-e is authorized and shows its number', async () => {
    install(operatorWriteUser, { queue: withNfe(true, [item(1, { nfe: { id: 3, status: 'authorized', number: '123' } })]) })
    render()

    expect(await screen.findByText('NF-e 123')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Despachar' })).toBeEnabled()
  })

  it('locks the rows whose NF-e is in flight or missing, and links a rejected note to its page', async () => {
    install(operatorWriteUser, {
      queue: withNfe(true, [
        item(1, { nfe: { id: 3, status: 'submitted', number: null } }),
        item(2, { nfe: null }),
        item(3, { nfe: { id: 9, status: 'rejected', number: null } }),
      ]),
    })
    render()

    const row = async (name: string) => (await screen.findByText(name)).closest('tr') as HTMLElement
    expect(within(await row('Cliente 1')).getByText('Aguardando NF-e: em emissão')).toBeInTheDocument()
    expect(within(await row('Cliente 1')).getByRole('button', { name: 'Despachar' })).toBeDisabled()
    expect(within(await row('Cliente 2')).getByText('Aguardando NF-e: sem nota registrada')).toBeInTheDocument()
    expect(within(await row('Cliente 2')).getByRole('button', { name: 'Despachar' })).toBeDisabled()
    expect(within(await row('Cliente 3')).getByRole('link', { name: 'Abrir nota' })).toHaveAttribute('href', '/operations/nfe/9')
  })

  it('locks Despachar de novo when the note of a failure was canceled', async () => {
    const user = userEvent.setup()
    install(operatorWriteUser, {
      queue: withNfe(true, [], [item(4, { delivery: delivery(7, 'failed'), nfe: { id: 5, status: 'canceled', number: null } })]),
    })
    render()

    await user.click(await screen.findByRole('tab', { name: /Falhas/ }))
    const row = (await screen.findByText('Cliente 4')).closest('tr') as HTMLElement
    expect(within(row).getByText('Aguardando NF-e: cancelada')).toBeInTheDocument()
    expect(within(row).queryByRole('link', { name: 'Abrir nota' })).not.toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Despachar de novo' })).toBeDisabled()
  })

  it('only informs the note while the lock is off', async () => {
    install(operatorWriteUser, { queue: withNfe(false, [item(1, { nfe: { id: 9, status: 'rejected', number: null } })]) })
    render()

    expect(await screen.findByText('NF-e: rejeitada')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Despachar' })).toBeEnabled()
  })

  it('explains a dispatch refused because the note changed after the queue loaded', async () => {
    const user = userEvent.setup()
    install(operatorWriteUser, {
      queue: withNfe(true, [item(1, { nfe: { id: 3, status: 'authorized', number: '123' } })]),
      dispatch: [{ status: 422, body: { success: false, message: 'locked', details: { code: 'courier_nfe_not_authorized', nfe_status: 'canceled', nfe_id: 3 } } }],
    })
    render()

    await user.click(await screen.findByRole('button', { name: 'Despachar' }))
    const dialog = await screen.findByRole('dialog', { name: 'Despachar entrega' })
    await user.click(within(dialog).getByRole('button', { name: 'Registrar saída' }))
    expect(await within(dialog).findByText('A caixa só sai com NF-e autorizada. Situação da nota: cancelada. Nada foi despachado.')).toBeInTheDocument()
  })

  // admin-flow-fixes-5 (PM-29): the queue reads a delivery range.
  // simplify-brazil-dispatch: "A despachar" opens on ready orders.
  it('asks for ready orders first, then every paid order with Mostrar todos, and back', async () => {
    const user = userEvent.setup()
    const { calls } = install()
    render('/operations/courier?problema=endereco')
    const searches = () => calls.filter((call) => call.path.endsWith('/courier-deliveries/queue')).map((call) => call.search)

    await waitFor(() => expect(searches()[0]).toBe(''))
    expect(screen.getByRole('button', { name: 'Só prontos' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Mostrar todos' }))
    await waitFor(() => expect(searches().at(-1)).toBe('?preparo=todos'))
    expect(screen.getByRole('button', { name: 'Mostrar todos' })).toHaveAttribute('aria-pressed', 'true')
    // The address filter from Hoje stays on top.
    expect(screen.getByText('Com problema de endereço')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Só prontos' }))
    await waitFor(() => expect(searches().at(-1)).toBe(''))
  })

  it('keeps preparo with the range of the URL and says no ready order is waiting', async () => {
    const { calls } = install(operatorWriteUser, { queue: { to_dispatch: [], out_for_delivery: [], failed: [], delivered: [], truncated: false } })
    render('/operations/courier?de=2026-11-01&ate=2026-11-03&preparo=todos')
    await waitFor(() => expect(calls.find((call) => call.path.endsWith('/courier-deliveries/queue'))?.search).toBe('?from=2026-11-01&to=2026-11-03&preparo=todos'))
    expect(await screen.findByText('Nenhum pedido pago esperando saída.')).toBeInTheDocument()
  })

  it('says no ready order is waiting on the default list', async () => {
    install(operatorWriteUser, { queue: { to_dispatch: [], out_for_delivery: [], failed: [], delivered: [], truncated: false } })
    render()
    expect(await screen.findByText('Nenhum pedido pronto esperando saída.')).toBeInTheDocument()
  })

  // simplify-brazil-dispatch: Expedir names the invoice.
  it('opens the dispatch dialog for the invoice Expedir names', async () => {
    install(operatorWriteUser, { queue: { to_dispatch: [item(1), item(2)], out_for_delivery: [], failed: [], delivered: [], truncated: false } })
    render('/operations/courier?fatura=in_2&assinatura=2')
    const dialog = await screen.findByRole('dialog', { name: 'Despachar entrega' })
    expect(dialog).toHaveTextContent('Cliente 2')
    expect(screen.queryByLabelText('Pedido fora do período')).not.toBeInTheDocument()
  })

  it('loads the range Expedir sends and opens that invoice', async () => {
    const { calls } = install(operatorWriteUser, { queue: { to_dispatch: [item(3, { delivery_date: '2026-11-11' })], out_for_delivery: [], failed: [], delivered: [], truncated: false } })
    render('/operations/courier?fatura=in_3&assinatura=3&de=2026-11-08&ate=2026-11-11')
    expect(await screen.findByRole('dialog', { name: 'Despachar entrega' })).toHaveTextContent('Cliente 3')
    expect(calls.find((call) => call.path.endsWith('/courier-deliveries/queue'))?.search).toBe('?from=2026-11-08&to=2026-11-11')
  })

  it('selects the tab of an invoice already on the road, without the dialog, over the aba of the URL', async () => {
    install()
    render('/operations/courier?aba=falhas&fatura=in_9&assinatura=9')
    await waitFor(() => expect(screen.getByRole('tab', { name: /Em rota/ })).toHaveAttribute('aria-selected', 'true'))
    expect(screen.queryByRole('dialog', { name: 'Despachar entrega' })).not.toBeInTheDocument()
  })

  it('says the invoice is outside this period and links to its subscription', async () => {
    install()
    render('/operations/courier?fatura=in_77&assinatura=42')
    const notice = await screen.findByLabelText('Pedido fora do período')
    expect(within(notice).getByRole('link', { name: 'Abrir a assinatura' })).toHaveAttribute('href', '/billing/subscriptions/42')
    expect(screen.queryByRole('dialog', { name: 'Despachar entrega' })).not.toBeInTheDocument()
  })

  it('does not open the dialog for an invoice whose address holds the box', async () => {
    install(operatorWriteUser, { queue: { to_dispatch: [item(4, { issues: ['missing_number'] })], out_for_delivery: [], failed: [], delivered: [], truncated: false } })
    render('/operations/courier?fatura=in_4&assinatura=4')
    expect(await screen.findByText('Cliente 4')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Despachar entrega' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Pedido fora do período')).not.toBeInTheDocument()
  })

  // simplify-brazil-dispatch: deliveries on the road closed together.
  const road = () => ({
    to_dispatch: [],
    out_for_delivery: [
      item(9, { delivery: delivery(5, 'out_for_delivery') }),
      item(10, { invoice_id: 'in_10', delivery: delivery(6, 'out_for_delivery', { stripe_invoice_id: 'in_10' }) }),
      item(11, { invoice_id: 'in_11', delivery: delivery(7, 'out_for_delivery', { stripe_invoice_id: 'in_11' }) }),
    ],
    failed: [],
    delivered: [],
    truncated: false,
  })

  it('closes the selected deliveries on the road at the time picked, one request each', async () => {
    const user = userEvent.setup()
    const { calls } = install(operatorWriteUser, { queue: road() })
    render('/operations/courier?aba=em_rota')

    await user.click(await screen.findByRole('checkbox', { name: 'Selecionar entrega de Cliente 9' }))
    await user.click(screen.getByRole('checkbox', { name: 'Selecionar entrega de Cliente 10' }))
    await user.click(screen.getByRole('button', { name: 'Marcar entregues (2)' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Marcar entregues' }))
    expect(dialog.getByRole('group', { name: 'Entregue em (horário de Brasília)' })).toBeInTheDocument()
    const day = dialog.getByLabelText('Data')
    const time = dialog.getByLabelText('Hora')
    expect((day as HTMLInputElement).value).toMatch(/^\d{2}\/\d{2}\/\d{4}$/)
    expect((time as HTMLInputElement).value).toMatch(/^\d{2}:\d{2}$/)
    await user.clear(day)
    await user.type(day, '08112026')
    await user.clear(time)
    await user.type(time, '1540')
    await user.click(dialog.getByRole('button', { name: 'Marcar entregues' }))

    expect(await screen.findByRole('status')).toHaveTextContent('2 entregas marcadas como entregues.')
    expect(posts(calls, '/delivered').map((call) => [call.path, call.body])).toEqual([
      ['/api/v1/admin/courier-deliveries/5/delivered', { delivered_at: '2026-11-08T18:40:00.000Z' }],
      ['/api/v1/admin/courier-deliveries/6/delivered', { delivered_at: '2026-11-08T18:40:00.000Z' }],
    ])
  })

  it('keeps a refused delivery selected with its error and closes the others', async () => {
    const user = userEvent.setup()
    install(operatorWriteUser, {
      queue: road(),
      actions: { delivered: { status: 422, body: { success: false, message: 'The delivery cannot be before the box left.', details: { code: 'invalid_field', field: 'delivered_at' } } } },
    })
    render('/operations/courier?aba=em_rota')

    await user.click(await screen.findByRole('checkbox', { name: 'Selecionar entrega de Cliente 9' }))
    await user.click(screen.getByRole('button', { name: 'Marcar entregues (1)' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Marcar entregues' })).getByRole('button', { name: 'Marcar entregues' }))

    expect(await screen.findByLabelText('Erro na entrega de Cliente 9')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Selecionar entrega de Cliente 9' })).toBeChecked()
    expect(screen.getAllByRole('alert').some((node) => node.textContent?.includes('1 entrega não foi marcada'))).toBe(true)
  })

  it('offers no control that selects every delivery', async () => {
    install(operatorWriteUser, { queue: road() })
    render('/operations/courier?aba=em_rota')
    await screen.findByRole('checkbox', { name: 'Selecionar entrega de Cliente 9' })
    expect(screen.getAllByRole('checkbox')).toHaveLength(3)
    expect(screen.queryByRole('button', { name: /Marcar entregues/ })).not.toBeInTheDocument()
  })

  it('shows no selection to a read-only account', async () => {
    install(readonlyUser, { queue: road() })
    render('/operations/courier?aba=em_rota')
    expect(await screen.findByText('Cliente 9')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('keeps the single-row Entregue: a confirmation and no date in the request', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('confirm', vi.fn(() => true))
    const { calls } = install(operatorWriteUser, { queue: road() })
    render('/operations/courier?aba=em_rota')

    const row = (await screen.findByText('Cliente 9')).closest('tr') as HTMLElement
    await user.click(within(row).getByRole('button', { name: 'Entregue' }))
    await waitFor(() => expect(posts(calls, '/5/delivered')).toHaveLength(1))
    expect(window.confirm).toHaveBeenCalled()
    expect(posts(calls, '/5/delivered')[0].body).toEqual({})
  })

  it('asks for the default range and says what comes later', async () => {
    const { calls } = install(operatorWriteUser, {
      queue: { to_dispatch: [item(1)], out_for_delivery: [], failed: [], delivered: [], truncated: false, range: { from: '2026-10-07', to: '2026-11-07', default: true }, later: 4, next_from: null },
    })
    render()

    expect(await screen.findByText('Cliente 1')).toBeInTheDocument()
    expect(calls.find((call) => call.path === '/api/v1/admin/courier-deliveries/queue')?.search).toBe('')
    expect(screen.getByRole('button', { name: 'Até amanhã' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Mais 4 pedidos com entrega depois de 07/11.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ver os próximos dias' }))
    await waitFor(() => expect(calls.filter((call) => call.path.endsWith('/courier-deliveries/queue')).at(-1)?.search).toBe('?from=2026-11-08&to=2026-11-14'))
  })

  it('sends the next seven days and the range of the URL', async () => {
    const { calls } = install()
    render('/operations/courier?aba=falhas&de=2026-11-01&ate=2026-11-03')

    await waitFor(() => expect(calls.find((call) => call.path.endsWith('/courier-deliveries/queue'))?.search).toBe('?from=2026-11-01&to=2026-11-03'))
    expect(await screen.findByText('Período: 01/11 a 03/11')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Falhas/ })).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Próximos 7 dias' }))
    const seven = nextSevenDays(COURIER_TIMEZONE)
    await waitFor(() => expect(calls.filter((call) => call.path.endsWith('/courier-deliveries/queue')).at(-1)?.search).toBe(`?from=${seven.from}&to=${seven.to}`))
    expect(screen.getByRole('tab', { name: /Falhas/ })).toHaveAttribute('aria-selected', 'true')
  })

  it('clears De and Até and goes back to the default range', async () => {
    const { calls } = install()
    render('/operations/courier?de=2026-11-01&ate=2026-11-03')

    expect(await screen.findByText('Período: 01/11 a 03/11')).toBeInTheDocument()
    expect(screen.getByLabelText('De')).toHaveValue('01/11/2026')
    expect(screen.getByLabelText('Até')).toHaveValue('03/11/2026')
    await userEvent.click(screen.getByRole('button', { name: 'Limpar datas' }))

    await waitFor(() => expect(calls.filter((call) => call.path.endsWith('/courier-deliveries/queue')).at(-1)?.search).toBe(''))
    expect(screen.getByRole('button', { name: 'Até amanhã' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('De')).toHaveValue('')
    expect(screen.getByLabelText('Até')).toHaveValue('')
  })

  it('offers the next cut when the list is truncated', async () => {
    const { calls } = install(operatorWriteUser, {
      queue: { to_dispatch: [item(1)], out_for_delivery: [], failed: [], delivered: [], truncated: true, range: { from: '2026-10-07', to: '2026-11-07', default: true }, later: 0, next_from: '2026-11-05' },
    })
    render()

    await userEvent.click(await screen.findByRole('button', { name: 'Ver a partir de 05/11' }))
    await waitFor(() => expect(calls.filter((call) => call.path.endsWith('/courier-deliveries/queue')).at(-1)?.search).toBe('?from=2026-11-05&to=2026-11-07'))
  })

  it('explains an invalid range', async () => {
    install(operatorWriteUser, { rangeError: true })
    render('/operations/courier?de=2020-01-01&ate=2020-01-03')

    expect(await screen.findByText('Período inválido: até 31 dias, a partir de 30 dias atrás.')).toBeInTheDocument()
  })

  // admin-flow-fixes-5 (PM-26): Hoje opens the queue on the rows with an address problem.
  it('keeps only the rows with an open address problem when Hoje asks', async () => {
    install(operatorWriteUser, {
      queue: {
        to_dispatch: [item(1, { address_issue: addressIssue }), item(2)],
        out_for_delivery: [],
        failed: [],
        delivered: [],
        truncated: false,
      },
    })
    render('/operations/courier?problema=endereco')

    expect(await screen.findByText('Cliente 1')).toBeInTheDocument()
    expect(screen.queryByText('Cliente 2')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: /Falhas/ }))
    expect(await screen.findByText('Nenhum pedido com problema de endereço neste período.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Remover filtro Com problema de endereço' }))
    await userEvent.click(screen.getByRole('tab', { name: /A despachar/ }))
    expect(await screen.findByText('Cliente 2')).toBeInTheDocument()
  })

  // keep-ready-orders-dispatchable: a row the address holds is listed too, even with no problem opened.
  it('keeps a row held by the address with no problem opened when Hoje asks', async () => {
    install(operatorWriteUser, {
      queue: {
        to_dispatch: [item(1, { issues: ['recipient_name_missing'], address_issue: null }), item(2, { issues: [] })],
        out_for_delivery: [],
        failed: [],
        delivered: [],
        truncated: false,
      },
    })
    render('/operations/courier?problema=endereco')

    const row = (await screen.findByText('Cliente 1')).closest('tr') as HTMLElement
    expect(within(row).getByText('Falta o nome de quem recebe')).toBeInTheDocument()
    expect(screen.queryByText('Cliente 2')).not.toBeInTheDocument()
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

// operator-fills-recipient-name: the recipient is the one address field the panel fills, and only when missing.
describe('CourierDeliveriesPage recipient name', () => {
  beforeEach(() => {
    seedAuth()
  })
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  const locked = (extra: Record<string, unknown> = {}) => item(1, {
    recipient_name: 'Ana Costa',
    name_source: 'account',
    account_name: 'Ana Costa',
    issues: ['recipient_name_missing'],
    ...extra,
  })

  function installRecipient(user = operatorWriteUser, { reply, row = locked() }: { reply?: Reply; row?: Record<string, unknown> } = {}) {
    let filled = false
    return installAdminFetchMock(user, {
      routes: ({ path, method }: { path: string; method: string }) => {
        if (path === '/api/v1/admin/courier-deliveries/queue' && method === 'GET') {
          const issues = ((row.issues as string[]) ?? []).filter((code) => !(filled && code === 'recipient_name_missing'))
          const current = filled ? { ...row, recipient_name: 'Ana Costa', name_source: 'recipient', issues } : row
          return json(200, { success: true, data: { to_dispatch: [current], out_for_delivery: [], failed: [], delivered: [], truncated: false } })
        }
        if (path === '/api/v1/admin/billing/subscriptions/1/recipient-name' && method === 'PATCH') {
          const answer = reply ?? { status: 200, body: { success: true, data: { subscription_id: '1', recipient_name: 'Ana Costa', courier_issues: [] } } }
          if (answer.status === 200) filled = true
          return json(answer.status, answer.body)
        }
        return undefined
      },
    })
  }

  const patches = (calls: Array<{ method: string; path: string; body?: unknown }>) => calls.filter((call) => call.method === 'PATCH' && call.path.endsWith('/recipient-name'))

  it('marks a name taken from the account', async () => {
    installRecipient()
    render()
    const name = await screen.findByText('Ana Costa', { selector: 'strong' })
    expect(name).toHaveTextContent('Ana Costa (conta)')
  })

  it('fills the suggested name only on the button and unlocks the row after saving', async () => {
    const user = userEvent.setup()
    const { calls } = installRecipient()
    render()
    await user.click(await screen.findByRole('button', { name: 'Informar quem recebe' }))
    const dialog = screen.getByRole('dialog', { name: 'Informar quem recebe' })
    const field = within(dialog).getByLabelText('Nome de quem recebe')
    expect(field).toHaveValue('')
    expect(within(dialog).getByText(/Se for presente, confirme com o cliente/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Usar nome da conta (Ana Costa)' }))
    expect(field).toHaveValue('Ana Costa')
    expect(patches(calls)).toHaveLength(0)
    await user.click(within(dialog).getByRole('button', { name: 'Salvar nome' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Nome de quem recebe salvo: Ana Costa.')
    expect(patches(calls)[0].body).toEqual({ recipient_name: 'Ana Costa' })
    expect(await screen.findByRole('button', { name: 'Despachar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Informar quem recebe' })).not.toBeInTheDocument()
  })

  it('shows a refused name under the field and keeps the dialog', async () => {
    const user = userEvent.setup()
    installRecipient(operatorWriteUser, { reply: { status: 422, body: { success: false, message: 'Invalid', details: { code: 'invalid_recipient_name', field: 'recipient_name' } } } })
    render()
    await user.click(await screen.findByRole('button', { name: 'Informar quem recebe' }))
    const dialog = screen.getByRole('dialog', { name: 'Informar quem recebe' })
    await user.type(within(dialog).getByLabelText('Nome de quem recebe'), '12')
    await user.click(within(dialog).getByRole('button', { name: 'Salvar nome' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Use de 2 a 60 caracteres, com pelo menos uma letra e sem @.')
    expect(within(dialog).getByLabelText('Nome de quem recebe')).toHaveAttribute('aria-invalid', 'true')
  })

  it('says when someone filled the name in between and reloads', async () => {
    const user = userEvent.setup()
    const { calls } = installRecipient(operatorWriteUser, { reply: { status: 409, body: { success: false, message: 'Present', details: { code: 'recipient_name_present' } } } })
    render()
    await user.click(await screen.findByRole('button', { name: 'Informar quem recebe' }))
    const dialog = screen.getByRole('dialog', { name: 'Informar quem recebe' })
    await user.type(within(dialog).getByLabelText('Nome de quem recebe'), 'João Lima')
    await user.click(within(dialog).getByRole('button', { name: 'Salvar nome' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Esta assinatura já tem nome de quem recebe.')
    expect(screen.queryByRole('dialog', { name: 'Informar quem recebe' })).not.toBeInTheDocument()
    await waitFor(() => expect(calls.filter((call) => call.path.endsWith('/courier-deliveries/queue'))).toHaveLength(2))
  })

  it('without an account name there is no suggestion button', async () => {
    const user = userEvent.setup()
    installRecipient(operatorWriteUser, { row: locked({ recipient_name: 'ana@example.com', name_source: 'email', account_name: null }) })
    render()
    await user.click(await screen.findByRole('button', { name: 'Informar quem recebe' }))
    expect(screen.queryByRole('button', { name: /Usar nome da conta/ })).not.toBeInTheDocument()
  })

  it('keeps the other lock after the name and offers nothing without the permission', async () => {
    installRecipient(readonlyUser)
    render()
    await screen.findByText('Falta o nome de quem recebe')
    expect(screen.queryByRole('button', { name: 'Informar quem recebe' })).not.toBeInTheDocument()
  })

  it('a row missing the name and the number stays locked by the number after saving', async () => {
    const user = userEvent.setup()
    installRecipient(operatorWriteUser, { row: locked({ issues: ['recipient_name_missing', 'address_number_missing'] }) })
    render()
    await user.click(await screen.findByRole('button', { name: 'Informar quem recebe' }))
    const dialog = screen.getByRole('dialog', { name: 'Informar quem recebe' })
    await user.type(within(dialog).getByLabelText('Nome de quem recebe'), 'Ana Costa')
    await user.click(within(dialog).getByRole('button', { name: 'Salvar nome' }))
    await screen.findByRole('status')
    expect(await screen.findByText('Falta o número')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Despachar' })).not.toBeInTheDocument()
  })
})
