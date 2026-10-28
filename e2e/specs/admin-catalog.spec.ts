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

  test('creates a product from the catalog list', async ({ page }) => {
    const { captured } = await openAuthed(page, '/catalog/products', e2eProfiles.operatorWrite)

    await page.getByText('Novo produto', { exact: true }).click()
    await page.getByPlaceholder('Ex.: Plano Adulto BR').fill('Plano novo')
    await page.getByRole('button', { name: 'Criar produto' }).click()
    await expect.poll(() => captured.find((item) => item.method === 'POST' && item.path === '/api/v1/admin/catalog/products')).toMatchObject({
      authorization: 'Bearer e2e-access-token',
      body: {
        name: 'Plano novo',
        planCountry: 'BR',
        planDays: 30,
      },
    })
    await expect(page.getByRole('button', { name: 'Adicionar variação' })).toBeVisible()
  })

  test('saves product plan fields', async ({ page }) => {
    const { captured } = await openAuthed(page, '/catalog/products/prod-1', e2eProfiles.operatorWrite)

    await expect(page.getByText('BOWL-1')).toBeVisible()
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Produto atualizado.')).toBeVisible()
    await expect.poll(() => captured.find((item) => item.method === 'PATCH' && item.path.endsWith('/catalog/products/prod-1'))).toMatchObject({
      authorization: 'Bearer e2e-access-token',
      body: {
        planCountry: 'BR',
        planDays: 28,
      },
    })
  })

  test('publishes edited variation prices', async ({ page }) => {
    const { captured } = await openAuthed(page, '/catalog/products/prod-1', e2eProfiles.operatorWrite)

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
            flavor: 'Frango',
            lifeStage: 'adult',
            shortLabel: '',
            finalImageReady: false,
            labelDataReady: false,
            regularPrice: 30,
            recipeKey: 'turkey',
          }],
        },
      }),
      expect.objectContaining({
        authorization: 'Bearer e2e-access-token',
        body: {
          planCountry: 'BR',
          planDays: 28,
          active: true,
        },
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

    await page.getByRole('button', { name: 'Excluir variação Frango 1kg' }).click()
    await expect.poll(() => captured.find((item) => item.method === 'DELETE' && item.path === '/api/v1/admin/catalog/products/prod-1/variations/var-1')).toMatchObject({
      authorization: 'Bearer e2e-access-token',
    })
    await expect(page.getByText('Variação "Frango 1kg" excluída.')).toBeVisible()
  })

  test('opens recipe content from the variation and uploads only a banner-sized image', async ({ page }) => {
    const { captured } = await openAuthed(page, '/catalog/products/prod-1', e2eProfiles.operatorWrite)

    await page.getByRole('link', { name: 'Conteúdo da receita de Frango 1kg' }).click()
    await expect(page).toHaveURL(/\/catalog\/recipes\/BR\/turkey$/)
    await expect(page.getByRole('heading', { name: 'Imagem' })).toBeVisible()
    await expect(page.getByText('Frango 1kg', { exact: true })).toBeVisible()

    await page.getByLabel('Escolher imagem').setInputFiles({ name: 'grande.png', mimeType: 'image/png', buffer: solidPng(1200, 800) })
    await expect(page.getByText('A imagem tem 1200 × 800 px e precisa ter 1024 × 636 px.')).toBeVisible()
    expect(captured.some((item) => item.method === 'PUT')).toBe(false)

    await page.getByLabel('Escolher imagem').setInputFiles({ name: 'banner.png', mimeType: 'image/png', buffer: solidPng(1024, 636) })
    await expect(page.getByRole('img', { name: 'Prévia da nova imagem' })).toBeVisible()
    await page.getByRole('button', { name: 'Salvar imagem' }).click()
    await expect(page.getByText('Imagem salva. A loja passa a usar esta imagem.')).toBeVisible()
    await expect.poll(() => captured.find((item) => item.method === 'PUT')).toEqual(expect.objectContaining({
      path: '/api/v1/admin/catalog/recipe-content/turkey/image',
      search: '?market=BR',
      authorization: 'Bearer e2e-access-token',
      body: expect.objectContaining({ mimeType: 'image/png' }),
    }))
  })

  test('fills and saves the recipe label', async ({ page }) => {
    const { captured } = await openAuthed(page, '/catalog/recipes/BR/turkey', e2eProfiles.operatorWrite)

    await expect(page.getByRole('heading', { name: 'Rótulo' })).toBeVisible()
    await page.getByRole('button', { name: 'Adicionar ingrediente' }).click()
    await page.getByLabel('Ingrediente 1', { exact: true }).fill('Frango')
    await page.getByRole('button', { name: 'Adicionar nível de garantia' }).click()
    await page.getByLabel('Nutriente 1', { exact: true }).fill('Proteína bruta (mín.)')
    await page.getByLabel('Valor 1', { exact: true }).fill('9,0%')
    await page.getByLabel('kcal/kg').fill('1.200 kcal/kg')
    await page.getByLabel('kcal por embalagem').fill('360 kcal por embalagem')
    await page.getByRole('button', { name: 'Salvar rótulo' }).click()

    await expect(page.getByText('Rótulo salvo e completo.')).toBeVisible()
    await expect(page.getByText('Rótulo completo')).toBeVisible()
    await expect.poll(() => captured.find((item) => item.method === 'PUT' && item.path.endsWith('/label'))).toEqual(expect.objectContaining({
      path: '/api/v1/admin/catalog/recipe-content/turkey/label',
      search: '?market=BR',
      body: { label: expect.objectContaining({ ingredients: ['Frango'], analysis: [{ nutrient: 'Proteína bruta (mín.)', value: '9,0%' }] }) },
    }))
  })

  test('unlinks a variation from its recipe in the variation dialog', async ({ page }) => {
    const { captured } = await openAuthed(page, '/catalog/products/prod-1', e2eProfiles.operatorWrite)

    await page.getByRole('button', { name: 'Editar variação Frango 1kg' }).click()
    const recipe = page.getByLabel('Receita (conteúdo)', { exact: true })
    await expect(recipe.getByRole('option', { name: 'Carne · beef' })).toBeAttached()
    await expect(recipe).toHaveValue('turkey')
    await recipe.selectOption({ label: 'Sem receita' })
    await page.getByRole('button', { name: 'Salvar variação' }).click()

    await expect(page.getByText('Sem receita vinculada')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Conteúdo da receita de Frango 1kg' })).toHaveCount(0)
    await expect.poll(() => captured.find((item) => item.method === 'PATCH')?.body).toEqual({
      variants: [expect.objectContaining({ id: 'var-1', recipeKey: null })],
    })
  })

  test('lists the recipes of the market and registers a new one', async ({ page }) => {
    const { captured } = await openAuthed(page, '/catalog/products', e2eProfiles.operatorWrite)

    await page.getByRole('link', { name: 'Receitas', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Receitas', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Carne' })).toHaveAttribute('href', '/catalog/recipes/BR/beef')
    await expect(page.getByRole('link', { name: 'Frango' })).toBeVisible()

    await page.getByRole('button', { name: 'Nova receita' }).click()
    await page.getByLabel('Nome', { exact: true }).fill('Sênior Cordeiro')
    await expect(page.getByLabel('Chave', { exact: true })).toHaveValue('senior-cordeiro')
    await page.getByRole('button', { name: 'Cadastrar receita' }).click()

    await expect(page).toHaveURL(/\/catalog\/recipes\/BR\/senior-cordeiro$/)
    await expect(page.getByRole('heading', { name: 'Sênior Cordeiro' })).toBeVisible()
    await expect(page.getByText(/Nenhuma variação usa esta receita/)).toBeVisible()
    expect(captured.find((item) => item.method === 'POST' && item.path === '/api/v1/admin/catalog/recipe-content')).toEqual(expect.objectContaining({
      search: '?market=BR',
      body: { key: 'senior-cordeiro', name: 'Sênior Cordeiro', lifeStage: 'adult' },
    }))
  })
})
