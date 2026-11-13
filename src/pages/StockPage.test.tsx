import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StockPage } from './StockPage'
import { adminUser, operatorUsUser, operatorWriteUser, readonlyUser, stockItemCarne, stockItemFrango } from '../test/fixtures'
import { findCall, installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

function renderStock(profile = operatorWriteUser, options: Parameters<typeof installAdminFetchMock>[1] = {}, route = '/operations/stock') {
  seedAuth()
  const mock = installAdminFetchMock(profile, options)
  renderAuthedPage(<StockPage />, route, '/operations/stock')
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

  it('shows ounces with the grams beside them in the US', async () => {
    renderStock(operatorUsUser, { stockItems: [{ ...stockItemFrango, packSizeGrams: 499 }] })
    const row = await frangoRow()
    expect(within(row).getByText('17.6 oz (499 g)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ações de frango 17.6 oz (499 g)' })).toBeInTheDocument()
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

  it('asks for the initial count when the market has no movements', async () => {
    renderStock(operatorWriteUser, { stockMovements: [] })
    expect(await screen.findByText('Falta a contagem inicial.')).toBeInTheDocument()
  })

  it('hides the initial count notice once there are movements', async () => {
    renderStock()
    await screen.findByText('frango')
    await waitFor(() => expect(screen.queryByText('Falta a contagem inicial.')).not.toBeInTheDocument())
  })

  it('hides the initial count notice from readonly users', async () => {
    renderStock(readonlyUser, { stockMovements: [] })
    await screen.findByText('frango')
    expect(screen.queryByText('Falta a contagem inicial.')).not.toBeInTheDocument()
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
    fireEvent.change(within(dialog).getByLabelText('Código do produto'), { target: { value: 'carne' } })
    fireEvent.change(within(dialog).getByLabelText('Tamanho (g)'), { target: { value: '500' } })
    fireEvent.change(within(dialog).getByLabelText('Quantidade'), { target: { value: '30' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Adicionar' }))

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
    fireEvent.change(within(dialog).getByLabelText('Código do produto'), { target: { value: 'invalido' } })
    fireEvent.change(within(dialog).getByLabelText('Tamanho (g)'), { target: { value: '100' } })
    fireEvent.change(within(dialog).getByLabelText('Quantidade'), { target: { value: '1' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Adicionar' }))

    expect(await within(dialog).findByText('Esse produto não tem variação com esse tamanho neste mercado.')).toBeInTheDocument()
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
    expect(screen.queryByRole('menuitem', { name: 'Lançar produção' })).not.toBeInTheDocument()
  })

  it('requires a note when the reason is Outro', async () => {
    const { calls } = renderStock()
    fireEvent.click(await screen.findByRole('button', { name: 'Ações de frango 300 g' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Ajustar' }))
    const dialog = await screen.findByRole('dialog', { name: /Ajustar/ })
    fireEvent.change(within(dialog).getByLabelText('Quantidade'), { target: { value: '-1' } })
    fireEvent.change(within(dialog).getByLabelText('Motivo'), { target: { value: 'other' } })
    expect(within(dialog).getByLabelText('Observação (obrigatória)')).toBeRequired()
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
    fireEvent.change(screen.getByLabelText('Buscar produto'), { target: { value: 'CARNE' } })
    expect(screen.queryByText('frango')).not.toBeInTheDocument()
    expect(screen.getByText('carne')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Situação'), { target: { value: 'short' } })
    expect(screen.getByText('Nenhum item com esses filtros.')).toBeInTheDocument()
  })

  it('picks product and size from the catalog and shows its names', async () => {
    const { calls } = renderStock(operatorWriteUser, {
      stockCatalog: [
        { flavorKey: 'frango', packSizeGrams: 300, label: 'Frango e Arroz', published: true },
        { flavorKey: 'carne', packSizeGrams: 300, label: 'Carne', published: true },
        { flavorKey: 'peixe', packSizeGrams: 300, label: 'Peixe', published: false },
        { flavorKey: 'carne', packSizeGrams: 500, label: 'Carne', published: true },
      ],
    })
    expect(await screen.findByText('Frango e Arroz')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Lançar produção' }))
    const dialog = await screen.findByRole('dialog', { name: 'Lançar produção' })
    expect(within(within(dialog).getByLabelText('Produto')).queryByRole('option', { name: 'Peixe' })).not.toBeInTheDocument()
    const size = within(dialog).getByLabelText('Tamanho')
    expect(size).toBeDisabled()
    fireEvent.change(within(dialog).getByLabelText('Produto'), { target: { value: 'carne' } })
    expect(within(size as HTMLElement).getByRole('option', { name: '500 g' })).toBeInTheDocument()
    fireEvent.change(size, { target: { value: '500' } })
    fireEvent.change(within(dialog).getByLabelText('Quantidade'), { target: { value: '5' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Adicionar' }))
    await waitFor(() => {
      expect(findCall(calls, 'POST', '/admin/stock/production')?.body).toEqual({
        market: 'BR',
        flavorKey: 'carne',
        packSizeGrams: 500,
        quantity: 5,
      })
    })
  })

  it('names each row after its product, links to it and shows code and SKU', async () => {
    renderStock(operatorWriteUser, {
      stockCatalog: [
        { flavorKey: 'frango', packSizeGrams: 300, label: 'Frango', productId: '2031', variationId: '1004', sku: 'F300', published: true },
        { flavorKey: 'carne', packSizeGrams: 300, label: 'Bovino', productId: '2025', variationId: '1001', sku: 'B300', published: true },
        { flavorKey: 'carne', packSizeGrams: 500, label: 'Bovino', productId: '2025', variationId: '1005', sku: 'B500', published: true },
        { flavorKey: 'senior-carne', packSizeGrams: 300, label: 'Bovino', productId: '2038', variationId: '2015', sku: null, published: true },
      ],
      stockItems: [stockItemFrango, stockItemCarne, { ...stockItemCarne, flavorKey: 'senior-carne', packSizeGrams: 300 }],
    })
    const link = await screen.findByRole('link', { name: 'Frango' })
    expect(link).toHaveAttribute('href', '/catalog/products/2031')
    const row = link.closest('tr') as HTMLTableRowElement
    expect(within(row).getByText('frango · SKU F300')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Bovino (senior-carne)' })).toHaveAttribute('href', '/catalog/products/2038')
    expect(screen.getByRole('link', { name: 'Bovino (carne)' })).toHaveAttribute('href', '/catalog/products/2025')
    fireEvent.change(screen.getByLabelText('Buscar produto'), { target: { value: 'b500' } })
    expect(screen.queryByRole('link', { name: 'Frango' })).not.toBeInTheDocument()
    expect(screen.getByText('carne · SKU B500')).toBeInTheDocument()
  })

  it('lists every variation on sale without weight by life stage, each row linking to its weight', async () => {
    renderStock(operatorWriteUser, {
      stockWithoutWeight: [
        { productId: '2039', productName: 'Frango', lifeStage: 'senior', variationId: '2016', name: null, sku: '3004' },
        { productId: '2038', productName: 'Bovino', lifeStage: 'senior', variationId: '2015', name: null, sku: '3003' },
        { productId: '2036', productName: 'Bovino e Frango', lifeStage: 'puppy', variationId: '2014', name: null, sku: '1004' },
        { productId: '2031', productName: 'Frango', lifeStage: 'adult', variationId: '2012', name: null, sku: '3001' },
        { productId: 'p9', productName: 'Peixe', lifeStage: 'adult', variationId: 'v9', name: null, sku: null },
      ],
    })
    expect(await screen.findByText('5 variações à venda estão sem peso')).toBeInTheDocument()
    const rows = within(screen.getByRole('list', { name: 'Variações sem peso' })).getAllByRole('link')
    expect(rows.map((row) => row.getAttribute('aria-label'))).toEqual([
      'Informar peso de Frango, Adulto, SKU 3001',
      'Informar peso de Peixe, Adulto',
      'Informar peso de Bovino e Frango, Filhote, SKU 1004',
      'Informar peso de Bovino, Sênior, SKU 3003',
      'Informar peso de Frango, Sênior, SKU 3004',
    ])
    expect(rows[0]).toHaveAttribute('href', '/catalog/products/2031?variation=2012&campo=peso')
    expect(within(rows[1]).getByText('Sem SKU')).toBeInTheDocument()
  })

  it('lists products without weight disabled in Lançar produção, with the reason', async () => {
    renderStock(operatorWriteUser, {
      stockCatalog: [
        { flavorKey: 'frango', packSizeGrams: 300, label: 'Frango', productId: '2031', variationId: '1004', sku: '1004', published: true },
      ],
      stockWithoutWeight: [
        { productId: '2031', productName: 'Frango', lifeStage: 'adult', variationId: '2012', name: null, sku: '3001' },
        { productId: '2038', productName: 'Bovino', lifeStage: 'senior', variationId: '2015', name: null, sku: '3003' },
        { productId: '2036', productName: 'Bovino e Frango', lifeStage: 'puppy', variationId: '2014', name: null, sku: '1004' },
      ],
    })
    await screen.findByText('3 variações à venda estão sem peso')
    fireEvent.click(screen.getByRole('button', { name: 'Lançar produção' }))
    const dialog = await screen.findByRole('dialog', { name: 'Lançar produção' })
    const select = within(dialog).getByLabelText('Produto')
    expect(select).toHaveAccessibleDescription(/2 produtos estão desabilitados/)
    expect(within(select).getByRole('option', { name: 'Frango' })).toBeEnabled()
    const group = within(select).getByRole('group', { name: 'Sem peso cadastrado' })
    expect(within(group).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Bovino e Frango · Filhote (sem peso)',
      'Bovino · Sênior (sem peso)',
    ])
    within(group).getAllByRole('option').forEach((option) => expect(option).toBeDisabled())
    expect(within(dialog).getByText(/2 produtos estão desabilitados porque não têm peso na variação\./)).toBeInTheDocument()

    fireEvent.change(select, { target: { value: 'frango' } })
    expect(within(dialog).queryByText(/produtos estão desabilitados/)).not.toBeInTheDocument()
    expect(select).not.toHaveAccessibleDescription()
  })

  it('names the free text Observação and explains it is not an invoice', async () => {
    renderStock()
    await screen.findByText('frango')
    fireEvent.click(screen.getByRole('button', { name: 'Lançar produção' }))
    const dialog = await screen.findByRole('dialog', { name: 'Lançar produção' })
    expect(within(dialog).queryByLabelText('Nota')).not.toBeInTheDocument()
    const field = within(dialog).getByLabelText('Observação (opcional)')
    expect(field).not.toBeRequired()
    expect(field).toHaveAccessibleDescription(/Não é nota fiscal\./)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sobre a observação' }))
    expect(within(dialog).getByRole('tooltip')).toBeVisible()
  })

  it('has no weight warning when every variation on sale has a weight', async () => {
    renderStock()
    await screen.findByText('frango')
    expect(screen.queryByText(/sem peso/)).not.toBeInTheDocument()
  })

  it('prefills production from the row with what is missing', async () => {
    renderStock()
    fireEvent.click(await screen.findByRole('button', { name: 'Ações de frango 300 g' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Lançar produção' }))
    const dialog = await screen.findByRole('dialog', { name: 'Lançar produção' })
    expect(within(dialog).getByLabelText('Código do produto')).toHaveValue('frango')
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

  it('sends the counted total and previews the new balance', async () => {
    const { calls } = renderStock()
    fireEvent.click(await screen.findByRole('button', { name: 'Ações de frango 300 g' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Contagem' }))
    const dialog = await screen.findByRole('dialog', { name: 'Contagem de frango 300 g' })
    fireEvent.change(within(dialog).getByLabelText('Quantidade contada'), { target: { value: '120' } })
    expect(within(dialog).getByText('Em estoque: 40 → novo saldo: 120')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }))
    await waitFor(() => {
      expect(findCall(calls, 'POST', '/admin/stock/counts')?.body).toEqual({
        market: 'BR',
        flavorKey: 'frango',
        packSizeGrams: 300,
        countedQuantity: 120,
      })
    })
    await waitFor(() => {
      expect(screen.getByText('frango').closest('tr')?.cells[2]).toHaveTextContent('120')
    })
  })

  it('leaves Contagem out of the adjustment reasons', async () => {
    renderStock()
    fireEvent.click(await screen.findByRole('button', { name: 'Ações de frango 300 g' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Ajustar' }))
    const dialog = await screen.findByRole('dialog', { name: /Ajustar/ })
    expect(within(dialog).queryByRole('option', { name: 'Contagem' })).not.toBeInTheDocument()
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

  it('opens a link with window, market and search', async () => {
    const { calls } = renderStock(adminUser, {}, '/operations/stock?mercado=US&janela=14&busca=frango')
    await waitFor(() => expect(findCall(calls, 'GET', '/admin/stock')?.search).toContain('market=US'))
    expect(findCall(calls, 'GET', '/admin/stock')?.search).toContain('windowDays=14')
    expect(screen.getByLabelText('Mercado')).toHaveValue('US')
    expect(screen.getByLabelText('Janela')).toHaveValue('14')
    expect(screen.getByLabelText('Buscar produto')).toHaveValue('frango')
  })

  it('keeps a BR operator in BR whatever the URL says', async () => {
    const { calls } = renderStock(operatorWriteUser, {}, '/operations/stock?mercado=US&janela=99')
    await screen.findByText('frango')
    expect(screen.getByLabelText('Mercado')).toHaveValue('BR')
    expect(findCall(calls, 'GET', '/admin/stock')?.search).toContain('market=BR')
    expect(findCall(calls, 'GET', '/admin/stock')?.search).toContain('windowDays=7')
  })
})
