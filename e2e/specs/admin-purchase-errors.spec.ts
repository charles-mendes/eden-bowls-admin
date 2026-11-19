import { expect, test } from '@playwright/test'
import { e2eProfiles, openAuthed } from '../helpers/mockAdminApi'

// purchase-error-monitor
test.describe('Erros de compra', () => {
  test('lists one market, expands a row and links to the customer trail', async ({ page }) => {
    const { captured } = await openAuthed(page, '/operations/purchase-errors', e2eProfiles.admin)
    await expect(page.getByRole('heading', { name: 'Erros de compra' })).toBeVisible()
    const item = page.locator('details.purchase-error-item').first()
    await expect(item.locator('summary')).toContainText('zipcode_lookup')
    await expect(item.locator('summary')).toContainText('Pago')
    await item.locator('summary').click()
    await expect(item.getByRole('table', { name: 'Passos da tentativa' })).toContainText('payment_intent_ack')
    await expect(page.getByRole('table', { name: 'Configuração com falha' })).toBeVisible()
    await expect.poll(() => captured.some((call) => call.path === '/api/v1/admin/purchase-trail/config-events' && call.search.includes('outcome=failed'))).toBe(true)

    await page.getByRole('group', { name: 'Mercado' }).getByRole('button', { name: 'Estados Unidos' }).click()
    await expect(page.getByText('cliente não resolvido')).toHaveCount(1)
    await expect(page.locator('details.purchase-error-item summary').getByText('zipcode_lookup')).toHaveCount(0)

    await page.getByRole('group', { name: 'Mercado' }).getByRole('button', { name: 'Brasil' }).click()
    await page.locator('details.purchase-error-item summary').first().click()
    await page.getByRole('link', { name: 'ana.carolina.de.souza.martins@example.com' }).click()
    await expect(page).toHaveURL(/\/users\/u-ana\?aba=trilha&mercado=BR/)
    await expect(page.getByRole('heading', { name: 'Trilha de compra · Brasil' })).toBeVisible()
  })

  test('readonly sees the page and the menu item', async ({ page }) => {
    await openAuthed(page, '/operations/purchase-errors', e2eProfiles.readonly)
    await expect(page.getByRole('heading', { name: 'Erros de compra' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Erros de compra' })).toBeVisible()
  })

  test('a veterinarian goes back and has no menu item', async ({ page }) => {
    await openAuthed(page, '/operations/purchase-errors', e2eProfiles.veterinarian)
    await expect(page.getByRole('heading', { name: 'Erros de compra' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Erros de compra' })).toHaveCount(0)
  })
})
