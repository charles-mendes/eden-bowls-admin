import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StockPage } from './StockPage'
import { operatorWriteUser, readonlyUser } from '../test/fixtures'
import { findCall, installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

function renderStock(profile = operatorWriteUser, options: Parameters<typeof installAdminFetchMock>[1] = {}) {
  seedAuth()
  const mock = installAdminFetchMock(profile, options)
  renderAuthedPage(<StockPage />, '/operations/stock')
  return mock
}

async function frangoRow() {
  return (await screen.findByText('frango')).closest('tr') as HTMLTableRowElement
}

describe('StockPage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('Kitchen sees what to produce', async () => {
    const { calls } = renderStock()
    const row = await frangoRow()

    expect(within(row).getByText('300 g')).toBeInTheDocument()
    expect(within(row).getByText('40')).toBeInTheDocument()
    expect(within(row).getByText('55')).toBeInTheDocument()
    expect(within(row).getByText('10 aguardando pagamento')).toBeInTheDocument()
    expect(within(row).getByText('-15')).toBeInTheDocument()
    expect(within(row).getByText('15')).toBeInTheDocument()
    expect(row).toHaveClass('stock-row-warning')
    expect(screen.getByText('frango').compareDocumentPosition(screen.getByText('carne'))).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(findCall(calls, 'GET', '/admin/stock')?.search).toContain('market=BR')
  })

  it('Empty market', async () => {
    renderStock(operatorWriteUser, { stockItems: [] })
    expect(await screen.findByText('Nenhum item de estoque nem entrega nesta janela.')).toBeInTheDocument()
  })

  it('Operator BR is locked', async () => {
    const { calls } = renderStock()
    await screen.findByText('frango')
    expect(screen.getByLabelText('Mercado')).toHaveValue('BR')
    expect(screen.getByLabelText('Mercado')).toBeDisabled()
    expect(screen.queryByRole('option', { name: 'Estados Unidos' })).not.toBeInTheDocument()
    expect(findCall(calls, 'GET', '/admin/stock')?.search).toContain('market=BR')
    expect(findCall(calls, 'GET', '/admin/stock/movements')?.search).toContain('market=BR')
  })

  it('Delivery with an unsized line', async () => {
    renderStock(operatorWriteUser, {
      stockUnsized: [{ subscriptionId: 123, flavorKey: 'frango', label: 'frango', quantity: 3 }],
    })
    expect(await screen.findByText('3 packs sem tamanho não entram no comprometido')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'frango × 3' })).toHaveAttribute('href', '/billing/subscriptions/123')
  })

  it('No unsized lines', async () => {
    renderStock()
    await screen.findByText('frango')
    expect(screen.queryByText(/packs sem tamanho/)).not.toBeInTheDocument()
  })

  it('Record a batch', async () => {
    const { calls } = renderStock()
    await screen.findByText('carne')
    fireEvent.click(screen.getByRole('button', { name: 'Lançar produção' }))
    const dialog = await screen.findByRole('dialog', { name: 'Lançar produção' })
    fireEvent.change(within(dialog).getByLabelText('Receita'), { target: { value: 'carne' } })
    fireEvent.change(within(dialog).getByLabelText('Tamanho (g)'), { target: { value: '500' } })
    fireEvent.change(within(dialog).getByLabelText('Quantidade'), { target: { value: '30' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lançar' }))

    await waitFor(() => {
      expect(findCall(calls, 'POST', '/admin/stock/production')?.body).toEqual({
        market: 'BR',
        flavorKey: 'carne',
        packSizeGrams: 500,
        quantity: 30,
      })
    })
    await waitFor(() => {
      const row = screen.getByText('carne').closest('tr') as HTMLTableRowElement
      expect(row.cells[2]).toHaveTextContent('40')
    })
  })

  it('Unknown size from the API', async () => {
    renderStock()
    await screen.findByText('frango')
    fireEvent.click(screen.getByRole('button', { name: 'Lançar produção' }))
    const dialog = await screen.findByRole('dialog', { name: 'Lançar produção' })
    fireEvent.change(within(dialog).getByLabelText('Receita'), { target: { value: 'invalido' } })
    fireEvent.change(within(dialog).getByLabelText('Tamanho (g)'), { target: { value: '100' } })
    fireEvent.change(within(dialog).getByLabelText('Quantidade'), { target: { value: '1' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lançar' }))

    expect(await within(dialog).findByText('Essa receita e tamanho não existem no catálogo deste mercado.')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Lançar produção' })).toBeInTheDocument()
  })

  it('Readonly sees no actions', async () => {
    renderStock(readonlyUser)
    await screen.findByText('frango')
    expect(screen.queryByRole('button', { name: 'Lançar produção' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ajustar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Definir mínimo' })).not.toBeInTheDocument()
  })

  it('requires a note when the reason is Outro', async () => {
    const { calls } = renderStock()
    fireEvent.click(await screen.findAllByRole('button', { name: 'Ajustar' }).then((buttons) => buttons[0]))
    const dialog = await screen.findByRole('dialog', { name: /Ajustar/ })
    fireEvent.change(within(dialog).getByLabelText('Quantidade'), { target: { value: '-1' } })
    fireEvent.change(within(dialog).getByLabelText('Motivo'), { target: { value: 'other' } })
    expect(within(dialog).getByLabelText('Nota')).toBeRequired()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))
    expect(findCall(calls, 'POST', '/admin/stock/adjustments')).toBeUndefined()
  })

  it('Separation links to the subscription', async () => {
    renderStock()
    const link = await screen.findByRole('link', { name: 'Assinatura 123' })
    expect(link).toHaveAttribute('href', '/billing/subscriptions/123')
    const row = link.closest('tr') as HTMLTableRowElement
    expect(row).toHaveTextContent('Separação')
    expect(row.cells[3]).toHaveTextContent('-3')
  })
})
