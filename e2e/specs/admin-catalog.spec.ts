import { expect, test } from '@playwright/test'
import { e2eProfiles, openAuthed } from '../helpers/mockAdminApi'

test.describe('Admin catalog', () => {
  test('loads the product list', async ({ page }) => {
    const { captured } = await openAuthed(page, '/catalog/products', e2eProfiles.operator)

    await expect(page.getByRole('heading', { name: 'Produtos', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Bowl Adulto' })).toBeVisible()
    await expect(page.getByPlaceholder('slug, nome pt ou en')).toHaveValue('')
    await expect(page.getByRole('combobox', { name: 'Mercado' })).toHaveValue('')
    await expect(page.getByRole('button', { name: 'Limpar busca' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Limpar mercado' })).toHaveCount(0)
    await expect.poll(() => captured.some((item) => (
      item.method === 'GET'
      && item.path === '/api/v1/admin/catalog/products'
      && item.search.includes('page=1')
      && !item.search.includes('market=')
      && !item.search.includes('search=')
      && item.authorization === 'Bearer e2e-access-token'
    ))).toBe(true)
  })

  test('clears catalog list filters with the side X', async ({ page }) => {
    const { captured } = await openAuthed(page, '/catalog/products', e2eProfiles.operator)

    await page.getByPlaceholder('slug, nome pt ou en').fill('bowl')
    await page.getByRole('combobox', { name: 'Mercado' }).selectOption('BR')
    await expect(page.getByRole('button', { name: 'Limpar busca' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Limpar mercado' })).toBeVisible()
    await expect.poll(() => captured.some((item) => (
      item.method === 'GET'
      && item.path === '/api/v1/admin/catalog/products'
      && item.search.includes('search=bowl')
      && item.search.includes('market=BR')
    ))).toBe(true)

    await page.getByRole('button', { name: 'Limpar busca' }).click()
    await page.getByRole('button', { name: 'Limpar mercado' }).click()
    await expect(page.getByPlaceholder('slug, nome pt ou en')).toHaveValue('')
    await expect(page.getByRole('combobox', { name: 'Mercado' })).toHaveValue('')
    await expect.poll(() => {
      const lastList = [...captured].reverse().find((item) => item.method === 'GET' && item.path === '/api/v1/admin/catalog/products')
      return Boolean(lastList && !lastList.search.includes('search=') && !lastList.search.includes('market='))
    }).toBe(true)
  })

  test('creates a product from the catalog list', async ({ page }) => {
    const { captured } = await openAuthed(page, '/catalog/products', e2eProfiles.operatorWrite)

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

    await expect(page.getByPlaceholder('SKU')).toHaveValue('BOWL-1')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Produto atualizado.')).toBeVisible()
    await expect.poll(() => captured.find((item) => item.method === 'PATCH' && item.path.endsWith('/catalog/products/prod-1'))).toMatchObject({
      authorization: 'Bearer e2e-access-token',
      body: {
        planCountry: 'BR',
        planDays: 28,
        variants: [{ id: 'var-1', sku: 'BOWL-1', name: 'Frango 1kg', regularPrice: 89.9 }],
      },
    })
  })

  test('publishes edited variation prices', async ({ page }) => {
    const { captured } = await openAuthed(page, '/catalog/products/prod-1', e2eProfiles.operatorWrite)

    await expect(page.getByPlaceholder('SKU')).toHaveValue('BOWL-1')
    await page.getByLabel('Preço').fill('30')
    await page.getByRole('button', { name: 'Publicar' }).click()
    await expect(page.getByText('Publicado.', { exact: true })).toBeVisible()
    await expect.poll(() => captured.find((item) => item.method === 'PATCH' && item.path.endsWith('/catalog/products/prod-1'))).toMatchObject({
      authorization: 'Bearer e2e-access-token',
      body: {
        planCountry: 'BR',
        planDays: 28,
        variants: [{ id: 'var-1', sku: 'BOWL-1', name: 'Frango 1kg', regularPrice: 30 }],
        active: true,
      },
    })
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
})
