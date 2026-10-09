import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ShippingPage } from './ShippingPage'
import { adminUser, operatorWriteUser, readonlyUser } from '../test/fixtures'
import { installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

describe('ShippingPage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('opens on the rules for a writer and saves only the Brazil rules, without the headquarters address', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<ShippingPage />, '/config/shipping')

    expect(await screen.findByRole('heading', { name: 'Entrega local' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Regras de entrega/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('group', { name: 'Mercado' })).not.toBeInTheDocument()
    expect(screen.queryByText('CD SP')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Latitude')).not.toBeInTheDocument()
    expect(screen.queryByText('Km/dia')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Salvar regras do Brasil' }))

    await waitFor(() => {
      expect(screen.getByText('Regras do Brasil salvas.')).toBeInTheDocument()
    })

    const put = calls.find((call) => call.method === 'PUT' && call.path === '/api/v1/admin/shipping/settings')
    expect(put?.authorization).toBe('Bearer access-token')
    expect(put?.body).toMatchObject({ br: { rule: { per_km: 0.95 } } })
    expect((put?.body as { br: Record<string, unknown> }).br).not.toHaveProperty('center')
    expect(put?.body).not.toHaveProperty('us')
  })

  it('opens on the simulator for readonly accounts and hides every mutation', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(readonlyUser)
    renderAuthedPage(<ShippingPage />, '/config/shipping')

    expect(await screen.findByRole('heading', { name: 'Simular frete por CEP' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Simulador/ })).toHaveAttribute('aria-selected', 'true')

    await user.click(screen.getByRole('tab', { name: /Regras de entrega/ }))
    expect(screen.queryByRole('button', { name: /Salvar regras/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Sede/ }))
    expect(await screen.findByText('CD SP')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /endereço/ })).not.toBeInTheDocument()
  })

  it('opens the tab and market from the URL', async () => {
    seedAuth()
    installAdminFetchMock(adminUser)
    renderAuthedPage(<ShippingPage />, '/config/shipping?aba=simulador&mercado=us', '/config/shipping')

    expect(await screen.findByRole('heading', { name: 'Simular frete por ZIP' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'EUA' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('validates the Brazil headquarters address before saving it', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(adminUser)
    renderAuthedPage(<ShippingPage />, '/config/shipping?aba=sede', '/config/shipping')

    const card = await screen.findByRole('article', { name: 'Sede Brasil' })
    expect(screen.queryByRole('article', { name: 'Sede Estados Unidos' })).not.toBeInTheDocument()
    await user.click(within(card).getByRole('button', { name: 'Cadastrar endereço' }))

    const save = within(card).getByRole('button', { name: 'Salvar sede' })
    expect(save).toBeDisabled()

    await user.clear(within(card).getByLabelText(/^CEP/))
    await user.type(within(card).getByLabelText(/^CEP/), '01310100')
    await user.tab()
    await waitFor(() => {
      expect(within(card).getByLabelText(/^Rua/)).toHaveValue('Avenida Paulista')
    })
    await user.type(within(card).getByLabelText(/^Número/), '1000')

    await user.click(within(card).getByRole('button', { name: 'Validar endereço' }))
    await waitFor(() => {
      expect(within(card).getByText('Endereço válido')).toBeInTheDocument()
    })
    expect(within(card).getByText(/-23\.56520, -46\.65140/)).toBeInTheDocument()

    await user.click(save)
    await waitFor(() => {
      expect(screen.getByText('Sede do Brasil salva.')).toBeInTheDocument()
    })
    const put = calls.find((call) => call.method === 'PUT' && call.path === '/api/v1/admin/shipping/settings')
    expect(put?.body).toMatchObject({ br: { center: { street: 'Avenida Paulista', number: '1000', zipcode: '01310-100' } } })
  })

  it('uses the US address format and shows field errors from the validation', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(adminUser)
    renderAuthedPage(<ShippingPage />, '/config/shipping?aba=sede&mercado=us', '/config/shipping')

    const card = await screen.findByRole('article', { name: 'Sede Estados Unidos' })
    await user.click(within(card).getByRole('button', { name: 'Alterar endereço' }))

    expect(within(card).getByLabelText(/^Address line 1/)).toHaveValue('100 Main St')
    expect(within(card).getByLabelText(/^Address line 2/)).toBeInTheDocument()
    expect(within(card).getByLabelText(/^ZIP code/)).toHaveValue('33101')

    await user.click(within(card).getByRole('button', { name: 'Validar endereço' }))
    await waitFor(() => {
      expect(within(card).getByText('O ZIP 33101 é de FL.')).toBeInTheDocument()
    })
    expect(within(card).getByRole('button', { name: 'Salvar sede' })).toBeDisabled()
  })

  it('shows only the UPS fields in UPS mode and simulates with the saved rules', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(adminUser)
    renderAuthedPage(<ShippingPage />, '/config/shipping')

    await user.click(await screen.findByRole('button', { name: 'EUA' }))
    expect(await screen.findByRole('heading', { name: 'Valor fixo' })).toBeInTheDocument()
    expect(screen.queryByText('Serviços aceitos')).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /UPS/ }))
    expect(screen.getByText('Serviços aceitos')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Valor de reserva' })).toBeInTheDocument()

    await user.click(screen.getByRole('switch', { name: /Se a UPS falhar/ }))
    expect(screen.queryByRole('heading', { name: 'Valor de reserva' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Regras de entrega/ })).toHaveTextContent('não salvo')

    await user.click(screen.getByRole('tab', { name: /Simulador/ }))
    expect(screen.getByText(/Há alterações não salvas nas regras dos EUA\. A simulação usa as regras salvas\./)).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('94105'), '94105')
    await user.click(screen.getByRole('button', { name: 'Simular' }))

    await waitFor(() => {
      expect(screen.getByText('Autenticação OAuth')).toBeInTheDocument()
    })
    expect(screen.getByText('Cotação com prazo (Shoptimeintransit)')).toBeInTheDocument()
    expect(screen.getAllByText('$18.45').length).toBeGreaterThan(0)
    expect(within(screen.getByRole('table')).getByText('UPS Next Day Air')).toBeInTheDocument()
    const post = calls.find((call) => call.method === 'POST' && call.path === '/api/v1/admin/shipping/test')
    expect(post?.body).toEqual({ zipCode: '94105', country: 'US' })

    await user.click(screen.getByRole('button', { name: 'Ir para Regras' }))
    expect(screen.getByRole('switch', { name: /Se a UPS falhar/ })).not.toBeChecked()
  })

  it('simulates a Brazil CEP as same-day delivery', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<ShippingPage />, '/config/shipping')

    await user.click(await screen.findByRole('tab', { name: /Simulador/ }))
    await user.type(screen.getByPlaceholderText('01310-100'), '01310100')
    await user.click(screen.getByRole('button', { name: 'Simular' }))

    await waitFor(() => {
      expect(screen.getByText('No mesmo dia do preparo')).toBeInTheDocument()
    })
    expect(screen.getByText(/8\.2 km de rota/)).toBeInTheDocument()
  })

  it('asks before switching market with unsaved rules and can keep, discard or save them', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(adminUser)
    renderAuthedPage(<ShippingPage />, '/config/shipping')

    const radius = await screen.findByRole('spinbutton', { name: /Raio de entrega/ })
    await user.clear(radius)
    await user.type(radius, '50')

    await user.click(screen.getByRole('button', { name: 'EUA' }))
    const dialog = screen.getByRole('dialog', { name: 'Alterações não salvas' })
    expect(within(dialog).getByText(/alterações não salvas nas regras do Brasil/)).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Continuar editando' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Brasil' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('spinbutton', { name: /Raio de entrega/ })).toHaveValue(50)

    await user.click(screen.getByRole('button', { name: 'EUA' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Salvar e trocar' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'EUA' })).toHaveAttribute('aria-pressed', 'true')
    })
    const put = calls.find((call) => call.method === 'PUT' && call.path === '/api/v1/admin/shipping/settings')
    expect(put?.body).toMatchObject({ br: { rule: { max_distance_km: 50 } } })
    expect(put?.body).not.toHaveProperty('us')
  })

  it('discards unsaved rules when switching market', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(adminUser)
    renderAuthedPage(<ShippingPage />, '/config/shipping')

    const radius = await screen.findByRole('spinbutton', { name: /Raio de entrega/ })
    const original = (radius as HTMLInputElement).value
    await user.clear(radius)
    await user.type(radius, '50')

    await user.click(screen.getByRole('button', { name: 'EUA' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Descartar e trocar' }))
    expect(screen.getByRole('button', { name: 'EUA' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Brasil' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: /Raio de entrega/ })).toHaveValue(Number(original))
    expect(calls.some((call) => call.method === 'PUT')).toBe(false)
  })

  it('keeps unsaved rules when the headquarters is saved', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(adminUser)
    renderAuthedPage(<ShippingPage />, '/config/shipping')

    const radius = await screen.findByRole('spinbutton', { name: /Raio de entrega/ })
    await user.clear(radius)
    await user.type(radius, '50')

    await user.click(screen.getByRole('tab', { name: /Sede/ }))
    const card = await screen.findByRole('article', { name: 'Sede Brasil' })
    await user.click(within(card).getByRole('button', { name: 'Cadastrar endereço' }))
    await user.clear(within(card).getByLabelText(/^CEP/))
    await user.type(within(card).getByLabelText(/^CEP/), '01310100')
    await user.tab()
    await waitFor(() => {
      expect(within(card).getByLabelText(/^Rua/)).toHaveValue('Avenida Paulista')
    })
    await user.type(within(card).getByLabelText(/^Número/), '1000')
    await user.click(within(card).getByRole('button', { name: 'Validar endereço' }))
    await waitFor(() => {
      expect(within(card).getByText('Endereço válido')).toBeInTheDocument()
    })
    await user.click(within(card).getByRole('button', { name: 'Salvar sede' }))
    await waitFor(() => {
      expect(screen.getByText('Sede do Brasil salva.')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('tab', { name: /Regras de entrega/ }))
    expect(screen.getByRole('spinbutton', { name: /Raio de entrega/ })).toHaveValue(50)
    expect(screen.getByRole('tab', { name: /Regras de entrega/ })).toHaveTextContent('não salvo')
  })

  it('points the simulator to the headquarters when it has no validated address', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(adminUser)
    renderAuthedPage(<ShippingPage />, '/config/shipping?aba=simulador', '/config/shipping')

    expect(await screen.findByText(/A sede do Brasil não tem endereço validado/)).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Sede/ })).toHaveTextContent('pendente')

    await user.click(screen.getByRole('button', { name: 'Cadastrar sede' }))
    expect(screen.getByRole('tab', { name: /Sede/ })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByRole('article', { name: 'Sede Brasil' })).toBeInTheDocument()
  })
})
