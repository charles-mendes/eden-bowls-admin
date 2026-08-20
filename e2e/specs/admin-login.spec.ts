import { expect, test } from '@playwright/test'
import { e2eProfiles, installAdminApiMocks } from '../helpers/mockAdminApi'

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

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await expect(page.getByText('ops@edenbowls.com')).toBeVisible()
    expect(tokenBodies).toEqual([{ username: 'ops@edenbowls.com', password: 'secret' }])
    expect(meAuth.some((value) => value === 'Bearer e2e-access-token')).toBe(true)
    await expect.poll(() => page.evaluate(() => localStorage.getItem('eden-bowls-admin-token'))).toBe('e2e-access-token')
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
    await expect(page.getByRole('link', { name: 'Dashboard' })).toHaveCount(0)

    await page.goto('/users')
    await expect(page).toHaveURL(/\/nutrition\/simulate/)
  })
})
