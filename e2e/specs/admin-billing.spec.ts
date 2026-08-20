import { expect, test } from '@playwright/test'
import { e2eProfiles, openAuthed } from '../helpers/mockAdminApi'

test.describe('Admin billing', () => {
  test('loads the subscriber list', async ({ page }) => {
    const { captured } = await openAuthed(page, '/billing', e2eProfiles.operatorWrite)

    await expect(page.getByRole('heading', { name: 'Assinantes' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'sub_123' })).toBeVisible()
    await expect.poll(() => captured.some((item) => item.method === 'GET' && item.path === '/api/v1/admin/billing/subscriptions')).toBe(true)
  })

  test('starts a catalog sync', async ({ page }) => {
    const { captured } = await openAuthed(page, '/billing', e2eProfiles.operatorWrite)

    await expect(page.getByRole('button', { name: 'Sync catálogo' })).toBeVisible()
    await page.getByRole('button', { name: 'Sync catálogo' }).click()
    await expect(page.getByText('Sync: queued')).toBeVisible()
    await expect.poll(() => captured.find((item) => item.method === 'POST' && item.path === '/api/v1/admin/catalog/sync')).toMatchObject({
      authorization: 'Bearer e2e-access-token',
      body: { market: 'BR', currency: 'BRL' },
    })
  })

  test('loads customer subscription detail', async ({ page }) => {
    await openAuthed(page, '/billing/subscriptions/sub-row-1', e2eProfiles.operatorWrite)

    await expect(page.getByRole('heading', { name: 'sub_123' })).toBeVisible()
    await expect(page.getByText('ana@edenbowls.com')).toBeVisible()
  })
})
