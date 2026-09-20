import { expect, test } from '@playwright/test'
import { e2eProfiles, openAuthed } from '../helpers/mockAdminApi'

test.describe('Admin production queue', () => {
  test('loads KPIs and a due row', async ({ page }) => {
    const { captured } = await openAuthed(page, '/operations/production', e2eProfiles.operatorWrite)

    await expect(page.getByRole('heading', { name: 'Produção' })).toBeVisible()
    await expect(page.getByText('Ana Ledger')).toBeVisible()
    await expect(page.getByText('WordPress Name')).toHaveCount(0)
    await expect(page.getByText('beef × 2, turkey × 1')).toBeVisible()
    await expect(page.getByLabel('Conta')).toHaveValue('br')
    await expect(page.getByLabel('Conta')).toBeDisabled()
    await expect(page.getByRole('option', { name: 'todas' })).toHaveCount(0)
    await expect(page.getByRole('option', { name: 'US' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Assinante', exact: true })).toHaveAttribute('href', '/billing/subscriptions/42')
    await expect(page.getByRole('table').getByRole('link', { name: 'Onboarding 360' })).toHaveAttribute('href', '/onboarding/sessions/u-ana')
    await expect.poll(() => captured.some((item) => (
      item.method === 'GET'
      && item.path === '/api/v1/admin/production/queue'
      && item.search.includes('account=br')
      && !item.search.includes('account=us')
    ))).toBe(true)
  })

  test('advances status as operator', async ({ page }) => {
    const { captured } = await openAuthed(page, '/operations/production', e2eProfiles.operatorWrite)

    await expect(page.getByRole('button', { name: 'Em produção' })).toBeVisible()
    await page.getByRole('button', { name: 'Em produção' }).click()

    await expect.poll(() => captured.some((item) => (
      item.method === 'PATCH'
      && item.path === '/api/v1/admin/production/queue/42'
    ))).toBe(true)
  })
})
