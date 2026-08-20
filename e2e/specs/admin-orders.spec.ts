import { expect, test } from '@playwright/test'
import { e2eProfiles, openAuthed } from '../helpers/mockAdminApi'

test.describe('Admin checkouts', () => {
  test('loads the checkout list', async ({ page }) => {
    const { captured } = await openAuthed(page, '/orders', e2eProfiles.operator)

    await expect(page.getByRole('heading', { name: 'Checkouts' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'ana@edenbowls.com' })).toBeVisible()
    await expect(page.getByText('sub_123')).toBeVisible()
    await expect.poll(() => captured.some((item) => (
      item.method === 'GET'
      && item.path === '/api/v1/admin/onboarding/checkouts'
      && item.authorization === 'Bearer e2e-access-token'
    ))).toBe(true)
  })

  test('loads checkout detail', async ({ page }) => {
    const { captured } = await openAuthed(page, '/orders/u-ana', e2eProfiles.operator)

    await expect(page.getByText(/Ana Costa/)).toBeVisible()
    await expect(page.getByRole('link', { name: 'sub_123' })).toBeVisible()
    await expect.poll(() => captured.some((item) => item.method === 'GET' && item.path === '/api/v1/admin/onboarding/checkouts/u-ana')).toBe(true)
  })
})
