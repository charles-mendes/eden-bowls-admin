import { expect, test } from '@playwright/test'
import { e2eProfiles, openAuthed } from '../helpers/mockAdminApi'

test.describe('Admin production queue', () => {
  test('loads the due counts and a row', async ({ page }) => {
    const { captured } = await openAuthed(page, '/operations/production', e2eProfiles.operatorWrite)

    await expect(page.getByRole('heading', { name: 'Fila de produção' })).toBeVisible()
    await expect(page.getByText('Ana Ledger')).toBeVisible()
    await expect(page.getByText('WordPress Name')).toHaveCount(0)
    await expect(page.getByText('beef × 2, turkey × 1')).toBeVisible()
    await expect(page.getByText('Falta estoque')).toBeVisible()
    await expect(page.getByRole('group', { name: 'Mercado' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Mais opções para Ana Ledger' }).click()
    const menu = page.getByRole('menu')
    await expect(menu.getByRole('menuitem', { name: 'Assinatura' })).toHaveAttribute('href', '/billing/subscriptions/42')
    await expect(menu.getByRole('menuitem', { name: 'Checkout' })).toHaveAttribute('href', '/users/u-ana?aba=checkout&assinatura=42')
    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    await expect.poll(() => captured.some((item) => (
      item.method === 'GET'
      && item.path === '/api/v1/admin/production/queue'
      && item.search.includes('account=br')
      && !item.search.includes('account=us')
    ))).toBe(true)
  })

  test('advances status as operator', async ({ page }) => {
    const { captured } = await openAuthed(page, '/operations/production', e2eProfiles.operatorWrite)

    await page.getByRole('button', { name: 'Iniciar preparo' }).click()

    await expect.poll(() => captured.some((item) => (
      item.method === 'PATCH'
      && item.path === '/api/v1/admin/production/queue/42'
    ))).toBe(true)
  })

  test('a pending item on Pendências opens the queue already filtered', async ({ page }) => {
    const { captured } = await openAuthed(page, '/dashboard', e2eProfiles.operatorWrite)

    await page.getByRole('region', { name: 'Produção' }).getByRole('link', { name: 'Ver na fila' }).click()
    await expect(page).toHaveURL(/\/operations\/production\?prazo=hoje/)
    await expect(page.getByRole('button', { name: /^Hoje/ })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('Prazo: Hoje')).toBeVisible()
    await expect.poll(() => captured.some((item) => (
      item.path === '/api/v1/admin/production/queue' && item.search.includes('due=today')
    ))).toBe(true)

    await page.getByRole('link', { name: '← Voltar para Pendências' }).click()
    await expect(page.getByRole('heading', { name: 'Pendências', exact: true })).toBeVisible()
  })
})
