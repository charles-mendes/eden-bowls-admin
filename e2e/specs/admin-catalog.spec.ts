import { expect, test } from '@playwright/test'
import { e2eProfiles, openAuthed } from '../helpers/mockAdminApi'
import { solidPng } from '../helpers/png'

test.describe('Admin catalog', () => {
  test('loads the product list', async ({ page }) => {
    const { captured } = await openAuthed(page, '/catalog/products', e2eProfiles.operator)

    await expect(page.getByRole('heading', { name: 'Produtos', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Bowl Adulto' })).toBeVisible()
    await expect(page.getByPlaceholder('slug, nome pt ou en')).toHaveValue('')
    await expect(page.getByRole('combobox', { name: 'Mercado', exact: true })).toHaveValue('BR')
    await expect(page.getByRole('combobox', { name: 'Mercado', exact: true })).toBeDisabled()
    await expect(page.getByRole('option', { name: 'Estados Unidos' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Limpar busca' })).toHaveCount(0)
    await expect.poll(() => captured.some((item) => (
      item.method === 'GET'
      && item.path === '/api/v1/admin/catalog/products'
      && item.search.includes('page=1')
      && item.search.includes('market=BR')
      && !item.search.includes('market=US')
      && !item.search.includes('search=')
      && item.authorization === 'Bearer e2e-access-token'
    ))).toBe(true)
  })

  test('clears catalog search and keeps the locked market', async ({ page }) => {
    const { captured } = await openAuthed(page, '/catalog/products', e2eProfiles.operator)

    await page.getByPlaceholder('slug, nome pt ou en').fill('bowl')
    await expect(page.getByRole('button', { name: 'Limpar busca' })).toBeVisible()
    await expect.poll(() => captured.some((item) => (
      item.method === 'GET'
      && item.path === '/api/v1/admin/catalog/products'
      && item.search.includes('search=bowl')
      && item.search.includes('market=BR')
    ))).toBe(true)

    await page.getByRole('button', { name: 'Limpar busca' }).click()
    await expect(page.getByPlaceholder('slug, nome pt ou en')).toHaveValue('')
    await expect(page.getByRole('combobox', { name: 'Mercado', exact: true })).toHaveValue('BR')
    await expect(page.getByRole('combobox', { name: 'Mercado', exact: true })).toBeDisabled()
    await expect.poll(() => {
      const lastList = [...captured].reverse().find((item) => item.method === 'GET' && item.path === '/api/v1/admin/catalog/products')
      return Boolean(lastList && !lastList.search.includes('search=') && lastList.search.includes('market=BR'))
    }).toBe(true)
  })

  test('creates a recipe product from the catalog list', async ({ page }) => {
    const { captured } = await openAuthed(page, '/catalog/products', e2eProfiles.operatorWrite)

    await page.getByRole('button', { name: 'Novo produto' }).click()
    const dialog = page.getByRole('dialog', { name: 'Novo produto' })
    await dialog.getByLabel('Nome', { exact: true }).fill('Receita de Cordeiro')
    await expect(dialog.getByLabel('Código', { exact: true })).toHaveValue('receita-de-cordeiro')
    await dialog.getByRole('button', { name: 'Criar produto' }).click()
    await expect.poll(() => captured.find((item) => item.method === 'POST' && item.path === '/api/v1/admin/catalog/products')).toMatchObject({
      authorization: 'Bearer e2e-access-token',
      body: { name: 'Receita de Cordeiro', planCountry: 'BR', code: 'receita-de-cordeiro', lifeStage: 'adult' },
    })
    await expect(page.getByRole('tab', { name: 'Dados gerais' })).toHaveAttribute('aria-selected', 'true')
  })

  test('keeps the create dialog open when the code is taken', async ({ page }) => {
    await openAuthed(page, '/catalog/products', e2eProfiles.operatorWrite)

    await page.getByRole('button', { name: 'Novo produto' }).click()
    const dialog = page.getByRole('dialog', { name: 'Novo produto' })
    await dialog.getByLabel('Nome', { exact: true }).fill('Peru')
    await dialog.getByLabel('Código', { exact: true }).fill('turkey')
    await dialog.getByRole('button', { name: 'Criar produto' }).click()
    await expect(dialog.getByText('Este mercado já tem um produto com esse código. Escolha outro código.')).toBeVisible()
    await expect(dialog.getByLabel('Nome', { exact: true })).toHaveValue('Peru')
  })

  test('saves the market plan settings on the Plano screen', async ({ page }) => {
    const { captured } = await openAuthed(page, '/catalog/plan?market=BR', e2eProfiles.operatorWrite)

    const limit = page.getByRole('spinbutton', { name: 'Limite do pacote pequeno' })
    await expect(limit).toHaveValue('8')
    await limit.fill('6')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Plano salvo.')).toBeVisible()
    await expect.poll(() => captured.find((item) => item.method === 'PUT' && item.path === '/api/v1/admin/catalog/plan-settings')).toMatchObject({
      authorization: 'Bearer e2e-access-token',
      search: '?market=BR',
      body: { planDays: 30, largePackLimit: 6 },
    })
  })

  test('saves the general data of the product', async ({ page }) => {
    const { captured } = await openAuthed(page, '/catalog/products/prod-1', e2eProfiles.operatorWrite)

    await expect(page.getByText('turkey', { exact: true })).toBeVisible()
    await page.getByLabel('Nome do produto').fill('Peru e Arroz')
    await expect(page.getByText('Dados gerais alterados. Salve antes de sair.')).toBeVisible()
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Dados gerais salvos.')).toBeVisible()
    await expect.poll(() => captured.find((item) => item.method === 'PATCH' && item.path.endsWith('/catalog/products/prod-1'))).toMatchObject({
      authorization: 'Bearer e2e-access-token',
      body: { name: 'Peru e Arroz', flavorAliases: '', shortLabel: '', lifeStage: 'adult' },
    })
  })

  test('publishes edited variation prices', async ({ page }) => {
    const { captured } = await openAuthed(page, '/catalog/products/prod-1', e2eProfiles.operatorWrite)

    await page.getByRole('tab', { name: 'Variações' }).click()
    await page.getByRole('button', { name: 'Editar variação Frango 1kg' }).click()
    await page.getByLabel('Preço').fill('30')
    await page.getByRole('button', { name: 'Salvar variação' }).click()
    await expect(page.getByText(/30,00/)).toBeVisible()
    await page.getByRole('button', { name: 'Publicar' }).click()
    await expect(page.getByText('Publicado.', { exact: true })).toBeVisible()
    await expect.poll(() => captured.filter((item) => item.method === 'PATCH' && item.path.endsWith('/catalog/products/prod-1'))).toEqual([
      expect.objectContaining({
        authorization: 'Bearer e2e-access-token',
        body: {
          variants: [{
            id: 'var-1',
            sku: 'BOWL-1',
            name: 'Frango 1kg',
            weight: '1kg',
            // A BR variation carries its fiscal fields (NF-e).
            ncm: '',
            origin: 0,
            finalImageReady: false,
            labelDataReady: false,
            regularPrice: 30,
          }],
        },
      }),
      expect.objectContaining({
        authorization: 'Bearer e2e-access-token',
        body: { active: true },
      }),
    ])
    await expect(page.getByText(/30,00/)).toBeVisible()
  })

  test('deletes a product from the catalog list', async ({ page }) => {
    page.once('dialog', (dialog) => dialog.accept())
    const { captured } = await openAuthed(page, '/catalog/products', e2eProfiles.operatorWrite)

    await page.getByRole('button', { name: 'Excluir produto Bowl Adulto' }).click()
    await expect.poll(() => captured.find((item) => item.method === 'DELETE' && item.path === '/api/v1/admin/catalog/products/prod-1')).toMatchObject({
      authorization: 'Bearer e2e-access-token',
    })
    await expect(page.getByRole('link', { name: 'Bowl Adulto' })).toHaveCount(0)
  })

  test('deletes a variation from the product detail', async ({ page }) => {
    page.once('dialog', (dialog) => dialog.accept())
    const { captured } = await openAuthed(page, '/catalog/products/prod-1', e2eProfiles.operatorWrite)

    await page.getByRole('tab', { name: 'Variações' }).click()
    await page.getByRole('button', { name: 'Excluir variação Frango 1kg' }).click()
    await expect.poll(() => captured.find((item) => item.method === 'DELETE' && item.path === '/api/v1/admin/catalog/products/prod-1/variations/var-1')).toMatchObject({
      authorization: 'Bearer e2e-access-token',
    })
    await expect(page.getByText('Variação "Frango 1kg" excluída.')).toBeVisible()
  })

  test('opens the Imagens tab from a pending item and uploads only a banner-sized image', async ({ page }) => {
    const { captured } = await openAuthed(page, '/catalog/products/prod-1', e2eProfiles.operatorWrite)

    await page.getByRole('tab', { name: 'Variações' }).click()
    await page.getByRole('button', { name: 'Abrir foto de Frango 1kg' }).click()
    await expect(page.getByRole('tab', { name: 'Imagens' })).toHaveAttribute('aria-selected', 'true')
    const panel = page.getByRole('tabpanel')
    await expect(panel.getByRole('heading', { name: 'Imagem da tela inicial' })).toBeVisible()

    await panel.getByLabel('Escolher imagem').setInputFiles({ name: 'grande.png', mimeType: 'image/png', buffer: solidPng(1200, 800) })
    await expect(panel.getByText('A imagem tem 1200 × 800 px e precisa ter 1024 × 636 px.')).toBeVisible()
    expect(captured.some((item) => item.method === 'PUT')).toBe(false)

    await panel.getByLabel('Escolher imagem').setInputFiles({ name: 'banner.png', mimeType: 'image/png', buffer: solidPng(1024, 636) })
    await expect(panel.getByRole('img', { name: 'Prévia da nova imagem' })).toBeVisible()
    await panel.getByRole('button', { name: 'Salvar imagem' }).click()
    await expect(panel.getByText('Imagem salva. A loja passa a usar esta imagem.')).toBeVisible()
    await expect.poll(() => captured.find((item) => item.method === 'PUT')).toEqual(expect.objectContaining({
      path: '/api/v1/admin/catalog/products/prod-1/content/image',
      authorization: 'Bearer e2e-access-token',
      body: expect.objectContaining({ mimeType: 'image/png' }),
    }))
  })

  test('fills and saves the label from an old recipe link', async ({ page }) => {
    const { captured } = await openAuthed(page, '/catalog/recipes/BR/turkey#rotulo', e2eProfiles.operatorWrite)

    await expect(page).toHaveURL(/\/catalog\/products\/prod-1#rotulo$/)
    await expect(page.getByRole('tab', { name: 'Rótulo' })).toHaveAttribute('aria-selected', 'true')
    await page.getByRole('button', { name: 'Adicionar ingrediente' }).click()
    await page.getByLabel('Ingrediente 1', { exact: true }).fill('Frango')
    await page.getByRole('button', { name: 'Adicionar nível de garantia' }).click()
    await page.getByLabel('Nutriente 1', { exact: true }).fill('Proteína bruta (mín.)')
    await page.getByLabel('Valor 1', { exact: true }).fill('9,0%')
    await page.getByLabel('kcal/kg').fill('1.200 kcal/kg')
    await page.getByLabel('kcal por embalagem').fill('360 kcal por embalagem')
    await page.getByRole('button', { name: 'Salvar rótulo' }).click()

    await expect(page.getByText('Rótulo salvo e completo.')).toBeVisible()
    await expect.poll(() => captured.find((item) => item.method === 'PUT' && item.path.endsWith('/label'))).toEqual(expect.objectContaining({
      path: '/api/v1/admin/catalog/products/prod-1/content/label',
      body: { label: expect.objectContaining({ ingredients: ['Frango'], analysis: [{ nutrient: 'Proteína bruta (mín.)', value: '9,0%' }] }) },
    }))
  })

  test('asks before leaving a tab with an unsaved label', async ({ page }) => {
    await openAuthed(page, '/catalog/products/prod-1#rotulo', e2eProfiles.operatorWrite)

    await page.getByLabel('Fabricante', { exact: true }).fill('Eden')
    page.once('dialog', (dialog) => dialog.dismiss())
    await page.getByRole('tab', { name: 'Variações' }).click()
    await expect(page.getByRole('tab', { name: 'Rótulo' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByLabel('Fabricante', { exact: true })).toHaveValue('Eden')
  })

  test('has no Receitas menu item and sends /catalog/recipes to Produtos', async ({ page }) => {
    await openAuthed(page, '/catalog/recipes', e2eProfiles.operatorWrite)

    await expect(page).toHaveURL(/\/catalog\/products$/)
    await expect(page.getByRole('link', { name: 'Receitas', exact: true })).toHaveCount(0)
  })
})
