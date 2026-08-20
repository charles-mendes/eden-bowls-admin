import { expect, test } from '@playwright/test'
import { e2eProfiles, openAuthed } from '../helpers/mockAdminApi'

test.describe('Admin catalog', () => {
  test('loads the product list', async ({ page }) => {
    const { captured } = await openAuthed(page, '/catalog/products', e2eProfiles.operator)

    await expect(page.getByRole('heading', { name: 'Produtos', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Bowl Adulto' })).toBeVisible()
    await expect.poll(() => captured.some((item) => (
      item.method === 'GET'
      && item.path === '/api/v1/admin/catalog/products'
      && item.search.includes('market=BR')
      && item.authorization === 'Bearer e2e-access-token'
    ))).toBe(true)
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
})
