import { expect, test } from '@playwright/test'
import { e2eProfiles, openAuthed } from '../helpers/mockAdminApi'

test.describe('Admin business overview', () => {
  test('opens the demonstration page and switches from Brasil to EUA', async ({ page }) => {
    const { captured } = await openAuthed(page, '/insights', e2eProfiles.admin)

    await expect(page.getByRole('heading', { name: 'Visão do negócio' })).toBeVisible()
    await expect(page.getByText('Dados de demonstração')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Visão do negócio' })).toBeVisible()
    await expect(page.getByText('R$ 241.390')).toBeVisible()
    await expect(page.getByText(/de Brasil nos últimos 30 dias/)).toBeVisible()

    await page.getByRole('button', { name: 'EUA' }).click()

    await expect(page.getByText(/de EUA nos últimos 30 dias/)).toBeVisible()
    await expect(page.getByText('Chicken curry')).toBeVisible()
    await expect(page.getByText('US$ 61.380')).toBeVisible()
    expect(captured.some((item) => item.path.includes('insights'))).toBe(false)
  })
})