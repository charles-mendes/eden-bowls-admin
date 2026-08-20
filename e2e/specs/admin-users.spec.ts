import { expect, test } from '@playwright/test'
import { e2eProfiles, openAuthed } from '../helpers/mockAdminApi'

test.describe('Admin users', () => {
  test('loads the customer list with Bearer', async ({ page }) => {
    const { captured } = await openAuthed(page, '/users', e2eProfiles.operator)

    await expect(page.getByRole('heading', { name: 'Clientes' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'ana@edenbowls.com' })).toBeVisible()
    await expect.poll(() => captured.some((item) => (
      item.method === 'GET'
      && item.path === '/api/v1/admin/users'
      && item.authorization === 'Bearer e2e-access-token'
      && item.search.includes('page=1')
    ))).toBe(true)
  })

  test('loads customer detail', async ({ page }) => {
    const { captured } = await openAuthed(page, '/users/u-ana', e2eProfiles.operator)

    await expect(page.getByRole('heading', { name: 'ana@edenbowls.com' })).toBeVisible()
    await expect(page.getByText(/Rua Augusta 100/)).toBeVisible()
    await expect.poll(() => captured.some((item) => (
      item.method === 'GET'
      && item.path === '/api/v1/admin/users/u-ana'
      && item.authorization === 'Bearer e2e-access-token'
    ))).toBe(true)
  })

  test('saves delivery instructions', async ({ page }) => {
    const { captured } = await openAuthed(page, '/users/u-ana', e2eProfiles.operatorWrite)

    await expect(page.getByRole('button', { name: 'Salvar instruções' })).toBeVisible()
    await page.getByRole('textbox').fill('Portão 2')
    await page.getByRole('button', { name: 'Salvar instruções' }).click()

    await expect(page.getByText('Instruções salvas.')).toBeVisible()
    await expect.poll(() => captured.find((item) => item.method === 'PATCH' && item.path.endsWith('/delivery-instructions'))).toMatchObject({
      authorization: 'Bearer e2e-access-token',
      body: { deliveryInstructions: 'Portão 2' },
    })
  })
})
