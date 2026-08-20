import { expect, test } from '@playwright/test'
import { e2eProfiles, openAuthed } from '../helpers/mockAdminApi'

test.describe('Admin onboarding 360', () => {
  test('loads the onboarding checkout list', async ({ page }) => {
    const { captured } = await openAuthed(page, '/onboarding/sessions', e2eProfiles.operator)

    await expect(page.getByRole('heading', { name: 'Onboarding 360' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'ana@edenbowls.com' })).toBeVisible()
    await expect.poll(() => captured.some((item) => item.method === 'GET' && item.path === '/api/v1/admin/onboarding/checkouts')).toBe(true)
    await expect.poll(() => captured.some((item) => item.path === '/api/v1/admin/onboarding/metrics')).toBe(true)
  })

  test('loads the 360 checkout detail', async ({ page }) => {
    await openAuthed(page, '/onboarding/sessions/u-ana', e2eProfiles.operator)

    await expect(page.getByText('Luna')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Ver cliente' })).toBeVisible()
  })
})
