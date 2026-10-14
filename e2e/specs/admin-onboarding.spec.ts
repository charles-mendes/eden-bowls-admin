import { expect, test } from '@playwright/test'
import { e2eProfiles, openAuthed } from '../helpers/mockAdminApi'

test.describe('Admin onboarding 360', () => {
  test('loads the onboarding checkout list', async ({ page }) => {
    const { captured } = await openAuthed(page, '/onboarding/sessions', e2eProfiles.operator)

    await expect(page.getByRole('heading', { name: 'Onboarding 360' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'ana@edenbowls.com' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Prazo (plano escolhido)' })).toBeVisible()
    await expect(page.getByText('1 mês')).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Recorrência' })).toHaveCount(0)
    await expect.poll(() => captured.some((item) => item.method === 'GET' && item.path === '/api/v1/admin/onboarding/checkouts')).toBe(true)
    await expect.poll(() => captured.some((item) => item.path === '/api/v1/admin/onboarding/metrics')).toBe(true)
  })

  test('redirects the old 360 detail to the customer Checkout tab', async ({ page }) => {
    await openAuthed(page, '/onboarding/sessions/u-ana', e2eProfiles.operator)

    await expect(page).toHaveURL(/\/users\/u-ana\?aba=checkout$/)
    await expect(page.getByText('Cliente já possui compra anterior')).toBeVisible()
    await expect(page.getByText('Rua Aristeu de Castro Fernandes, 941')).toBeVisible()
    await expect(page.getByText('Entrega Eden Bowl')).toBeVisible()
    await expect(page.getByText('beef × 5, fish × 5')).toBeVisible()
  })

  test('customer tabs show pets and subscriptions', async ({ page }) => {
    const { captured } = await openAuthed(page, '/users/u-ana', e2eProfiles.operator)

    await page.getByRole('tab', { name: 'Assinaturas' }).click()
    await expect(page).toHaveURL(/\?aba=assinaturas$/)
    await expect(page.getByRole('link', { name: 'sub_123' })).toBeVisible()
    expect(captured.some((item) => item.path === '/api/v1/admin/onboarding/checkouts/u-ana')).toBe(false)

    await page.getByRole('tab', { name: 'Pets' }).click()
    await expect(page.getByRole('cell', { name: 'Luna' })).toBeVisible()
    await expect.poll(() => captured.some((item) => item.method === 'GET' && item.path === '/api/v1/admin/onboarding/checkouts/u-ana')).toBe(true)
  })
})
