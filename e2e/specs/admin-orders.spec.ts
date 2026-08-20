import { expect, test } from '@playwright/test'
import { e2eProfiles, openAuthed } from '../helpers/mockAdminApi'

test.describe('Admin checkouts', () => {
  test('redirects the checkout list to onboarding 360', async ({ page }) => {
    const { captured } = await openAuthed(page, '/orders', e2eProfiles.operator)

    await expect(page).toHaveURL(/\/onboarding\/sessions$/)
    await expect(page.getByRole('heading', { name: 'Onboarding 360' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'ana@edenbowls.com' })).toBeVisible()
    await expect.poll(() => captured.some((item) => (
      item.method === 'GET'
      && item.path === '/api/v1/admin/onboarding/checkouts'
      && item.authorization === 'Bearer e2e-access-token'
    ))).toBe(true)
  })

  test('redirects checkout detail to the 360 checkout detail', async ({ page }) => {
    const { captured } = await openAuthed(page, '/orders/u-ana', e2eProfiles.operator)

    await expect(page).toHaveURL(/\/onboarding\/sessions\/u-ana$/)
    await expect(page.getByRole('heading', { name: 'Checkout ana@edenbowls.com' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'sub_123' })).toBeVisible()
    await expect(page.getByText('Rua Aristeu de Castro Fernandes, 941')).toBeVisible()
    await expect(page.getByText('Bovino × 5, Peixe × 5')).toBeVisible()
    await expect(page.getByText('Entrega Eden Bowl')).toBeVisible()
    await expect.poll(() => captured.some((item) => item.method === 'GET' && item.path === '/api/v1/admin/onboarding/checkouts/u-ana')).toBe(true)
  })
})
