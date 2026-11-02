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
    fireEvent.click(screen.getByRole('button', { name: 'Ações de frango 300 g' }))
    expect(screen.getByRole('menuitem', { name: 'Ver histórico' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Ajustar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Definir mínimo' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Produzir' })).not.toBeInTheDocument()
  })

  it('requires a note when the reason is Outro', async () => {
    const { calls } = renderStock()
    fireEvent.click(await screen.findByRole('button', { name: 'Ações de frango 300 g' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Ajustar' }))
    const dialog = await screen.findByRole('dialog', { name: /Ajustar/ })
    fireEvent.change(within(dialog).getByLabelText('Quantidade'), { target: { value: '-1' } })
    fireEvent.change(within(dialog).getByLabelText('Motivo'), { target: { value: 'other' } })
    expect(within(dialog).getByLabelText('Nota')).toBeRequired()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))
    expect(findCall(calls, 'POST', '/admin/stock/adjustments')).toBeUndefined()
  })

  it('tells that stock is internal and does not affect sales', async () => {
    renderStock()
    await screen.findByText('frango')
    expect(screen.getByRole('note')).toHaveTextContent('O estoque não bloqueia vendas nem renovações')
  })

  it('summarises the window and shows each status', async () => {
    renderStock()
    const row = await frangoRow()
    expect(within(row).getByText('Em falta')).toHaveClass('badge-error')
    expect(within(screen.getByText('A produzir', { selector: '.eyebrow' }).closest('article') as HTMLElement).getByText('15')).toBeInTheDocument()
  })

  it('filters packs by search and status', async () => {
    renderStock()
    await screen.findByText('frango')
    fireEvent.change(screen.getByLabelText('Buscar receita'), { target: { value: 'CARNE' } })
    expect(screen.queryByText('frango')).not.toBeInTheDocument()
    expect(screen.getByText('carne')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Situação'), { target: { value: 'short' } })
    expect(screen.getByText('Nenhum item com esses filtros.')).toBeInTheDocument()
  })

  it('picks recipe and size from the catalog and shows its names', async () => {
    const { calls } = renderStock(operatorWriteUser, {
      stockCatalog: [
        { flavorKey: 'frango', packSizeGrams: 300, label: 'Frango e Arroz' },
        { flavorKey: 'carne', packSizeGrams: 300, label: 'Carne' },
        { flavorKey: 'carne', packSizeGrams: 500, label: 'Carne' },
      ],
    })
    expect(await screen.findByText('Frango e Arroz')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Lançar produção' }))
    const dialog = await screen.findByRole('dialog', { name: 'Lançar produção' })
    const size = within(dialog).getByLabelText('Tamanho (g)')
    expect(size).toBeDisabled()
    fireEvent.change(within(dialog).getByLabelText('Receita'), { target: { value: 'carne' } })
    expect(within(size as HTMLElement).getByRole('option', { name: '500 g' })).toBeInTheDocument()
    fireEvent.change(size, { target: { value: '500' } })
    fireEvent.change(within(dialog).getByLabelText('Quantidade'), { target: { value: '5' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lançar' }))
    await waitFor(() => {
      expect(findCall(calls, 'POST', '/admin/stock/production')?.body).toEqual({
        market: 'BR',
        flavorKey: 'carne',
        packSizeGrams: 500,
        quantity: 5,
      })
    })
  })

  it('prefills production from the row with what is missing', async () => {
    renderStock()
    fireEvent.click(await screen.findByRole('button', { name: 'Ações de frango 300 g' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Produzir' }))
    const dialog = await screen.findByRole('dialog', { name: 'Lançar produção' })
    expect(within(dialog).getByLabelText('Receita')).toHaveValue('frango')
    expect(within(dialog).getByLabelText('Tamanho (g)')).toHaveValue(300)
    expect(within(dialog).getByLabelText('Quantidade')).toHaveValue(15)
  })

  it('previews the new balance and refuses a zero adjustment', async () => {
    const { calls } = renderStock()
    fireEvent.click(await screen.findByRole('button', { name: 'Ações de frango 300 g' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Ajustar' }))
    const dialog = await screen.findByRole('dialog', { name: /Ajustar/ })
    fireEvent.change(within(dialog).getByLabelText('Quantidade'), { target: { value: '-2' } })
    expect(within(dialog).getByText('Em estoque: 40 → novo saldo: 38')).toBeInTheDocument()
    fireEvent.change(within(dialog).getByLabelText('Quantidade'), { target: { value: '0' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))
    expect(await within(dialog).findByText('Informe uma quantidade diferente de zero.')).toBeInTheDocument()
    expect(findCall(calls, 'POST', '/admin/stock/adjustments')).toBeUndefined()
  })

  it('opens the history of one item from the row', async () => {
    const { calls } = renderStock()
    fireEvent.click(await screen.findByRole('button', { name: 'Ações de frango 300 g' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Ver histórico' }))
    expect(screen.getByLabelText('Item do histórico')).toHaveValue('frango|300')
    await waitFor(() => {
      expect(calls.some((call) => call.path.endsWith('/admin/stock/movements') && call.search.includes('packSizeGrams=300'))).toBe(true)
    })
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
