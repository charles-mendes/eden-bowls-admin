import { expect, test } from '@playwright/test'
import { e2eProfiles, installAdminApiMocks, openAuthed } from '../helpers/mockAdminApi'

test.describe('Admin login', () => {
  test('logs in as operator with Bearer session', async ({ page }) => {
    const tokenBodies: unknown[] = []
    const meAuth: string[] = []

    await installAdminApiMocks(page)

    page.on('request', (request) => {
      if (request.url().includes('/api/v1/auth/token')) {
        tokenBodies.push(request.postDataJSON())
      }
      if (request.url().includes('/api/v1/admin/me')) {
        meAuth.push(request.headers().authorization ?? '')
      }
    })

    await page.goto('/login')
    await page.getByLabel('E-mail').fill('ops@edenbowls.com')
    await page.getByLabel('Senha').fill('secret')
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page.getByRole('heading', { name: 'Hoje', exact: true })).toBeVisible()
    await expect(page.getByText('ops@edenbowls.com')).toBeVisible()
    expect(tokenBodies).toEqual([{ username: 'ops@edenbowls.com', password: 'secret' }])
    expect(meAuth.some((value) => value === 'Bearer e2e-access-token')).toBe(true)
    await expect.poll(() => page.evaluate(() => localStorage.getItem('eden-bowls-admin-token'))).toBe('e2e-access-token')
  })

  test('an operator sees the day without the system health panel', async ({ page }) => {
    const { captured } = await openAuthed(page, '/dashboard', e2eProfiles.operator)

    await expect(page.getByRole('heading', { name: 'Hoje', exact: true })).toBeVisible()
    await expect(page.getByText('Ana Ledger')).toBeVisible()
    await expect(page.getByText('Saúde do sistema')).toHaveCount(0)
    await expect(page.getByRole('group', { name: 'Mercado' })).toHaveCount(0)
    await expect.poll(() => captured.some((item) => item.path === '/api/v1/admin/catalog/sync/health')).toBe(false)
    await expect.poll(() => captured.some((item) => item.path === '/api/v1/admin/markets/conflicts')).toBe(false)
    await expect.poll(() => captured.some((item) => item.path === '/api/v1/admin/billing/webhooks/health')).toBe(false)
  })

  test('admin dashboard shows webhooks, market conflicts and the last sync', async ({ page }) => {
    const { captured } = await openAuthed(page, '/dashboard', e2eProfiles.admin)

    await page.getByText('Saúde do sistema').click()
    const health = page.locator('.day-health')

    await expect(health.getByRole('heading', { name: 'Webhooks Stripe' })).toBeVisible()
    await expect(health.getByRole('row', { name: /Brasil/ }).getByText('Atenção')).toBeVisible()
    await expect(health.getByRole('row', { name: /EUA/ }).getByText('OK')).toBeVisible()
    await expect(health.getByRole('heading', { name: 'Conflitos de mercado' })).toBeVisible()
    await expect(health.getByRole('row', { name: /ana@edenbowls\.com/ })).toBeVisible()
    await expect(health.getByText(/Última sincronização Brasil: concluído/)).toBeVisible()
    await expect(health.getByText('Checkouts', { exact: true })).toHaveCount(0)
    await expect.poll(() => captured.some((item) => (
      item.method === 'GET'
      && item.path === '/api/v1/admin/markets/conflicts'
      && item.authorization === 'Bearer e2e-access-token'
    ))).toBe(true)
    await expect.poll(() => captured.some((item) => item.path === '/api/v1/admin/billing/webhooks/health')).toBe(true)
    expect(captured.some((item) => item.path === '/api/v1/admin/onboarding/metrics')).toBe(false)
  })

  test('blocks a customer account from the shell', async ({ page }) => {
    await installAdminApiMocks(page, { profile: e2eProfiles.customer })

    await page.goto('/login')
    await page.getByLabel('E-mail').fill('client@edenbowls.com')
    await page.getByLabel('Senha').fill('secret')
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page.getByText('Esta conta não tem acesso ao painel administrativo.')).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
    expect(await page.evaluate(() => localStorage.getItem('eden-bowls-admin-token'))).toBeNull()
  })

  test('keeps a nutritionist on the simulator', async ({ page }) => {
    await installAdminApiMocks(page, { profile: e2eProfiles.nutritionist })

    await page.goto('/login')
    await page.getByLabel('E-mail').fill('nutri@edenbowls.com')
    await page.getByLabel('Senha').fill('secret')
    await page.getByRole('button', { name: 'Entrar' }).click()

    await expect(page.getByRole('heading', { name: 'Nutrition simulator' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Simulador nutricional' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Hoje' })).toHaveCount(0)

    await page.goto('/users')
    await expect(page).toHaveURL(/\/nutrition\/simulate/)
  })
})
