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

  test('syncs first-purchase coupons with Stripe', async ({ page }) => {
    const { captured } = await openAuthed(page, '/billing/coupons', e2eProfiles.operatorWrite)

    await expect(page.getByRole('heading', { name: 'Cupons de 1ª compra' })).toBeVisible()
    await expect(page.getByLabel('1 mês(es) — 10%')).toHaveValue('promo_1m')
    await expect(page.getByText(/Slots também definidos via env/)).toHaveCount(0)

    await page.getByRole('button', { name: 'Sincronizar com Stripe' }).click()
    await expect(page.getByText('Slots sincronizados com a Stripe.')).toBeVisible()
    await expect.poll(() => captured.find((item) => item.method === 'POST' && item.path === '/api/v1/admin/stripe/first-purchase-promos/sync')).toMatchObject({
      authorization: 'Bearer e2e-access-token',
    })
  })
})
