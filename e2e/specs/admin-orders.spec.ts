import { expect, test } from '@playwright/test'
import { e2eProfiles, openAuthed } from '../helpers/mockAdminApi'

test.describe('Admin checkouts', () => {
  test('redirects the old checkout list to Clientes', async ({ page }) => {
    await openAuthed(page, '/orders', e2eProfiles.operator)

    await expect(page).toHaveURL(/\/users$/)
  })

  test('redirects checkout detail to the customer Checkout tab', async ({ page }) => {
    const { captured } = await openAuthed(page, '/orders/u-ana', e2eProfiles.operator)

    await expect(page).toHaveURL(/\/users\/u-ana\?aba=checkout$/)
    await expect(page.getByRole('tab', { name: 'Checkout' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByText('Rua Aristeu de Castro Fernandes, 941')).toBeVisible()
    await expect(page.getByText('beef × 5, fish × 5')).toBeVisible()
    await expect(page.getByText('Entrega Eden Bowl')).toBeVisible()
    await expect.poll(() => captured.some((item) => item.method === 'GET' && item.path === '/api/v1/admin/onboarding/checkouts/u-ana')).toBe(true)
  })
})
