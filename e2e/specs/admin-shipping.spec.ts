import { expect, test } from '@playwright/test'
import { e2eProfiles, openAuthed } from '../helpers/mockAdminApi'

test.describe('Admin shipping', () => {
  test('a writer lands on the rules and moves between tabs through the URL', async ({ page }) => {
    await openAuthed(page, '/config/shipping', e2eProfiles.admin)

    await expect(page.getByRole('tab', { name: /Regras de entrega/ })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('heading', { name: 'Entrega local' })).toBeVisible()

    await page.getByRole('tab', { name: /Simulador/ }).click()
    await expect(page).toHaveURL(/aba=simulador/)
    await expect(page.getByRole('heading', { name: 'Simular frete por CEP' })).toBeVisible()

    await page.getByRole('tab', { name: /Simulador/ }).press('ArrowLeft')
    await expect(page.getByRole('tab', { name: /Sede/ })).toBeFocused()
    await expect(page.getByRole('article', { name: 'Sede Brasil' })).toBeVisible()

    await page.goBack()
    await expect(page.getByRole('heading', { name: 'Simular frete por CEP' })).toBeVisible()
  })

  test('opens the US simulator from a shared link', async ({ page }) => {
    await openAuthed(page, '/config/shipping?aba=simulador&mercado=us', e2eProfiles.admin)

    await expect(page.getByRole('heading', { name: 'Simular frete por ZIP' })).toBeVisible()
    await expect(page.getByRole('group', { name: 'Mercado' }).getByRole('button', { name: 'EUA' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('asks before switching market with unsaved rules', async ({ page }) => {
    const { captured } = await openAuthed(page, '/config/shipping', e2eProfiles.admin)

    await page.getByLabel('Raio de entrega').fill('50')
    await expect(page.getByRole('tab', { name: /Regras de entrega/ })).toContainText('não salvo')

    await page.getByRole('group', { name: 'Mercado' }).getByRole('button', { name: 'EUA' }).click()
    const dialog = page.getByRole('dialog', { name: 'Alterações não salvas' })
    await expect(dialog).toContainText('regras do Brasil')

    await dialog.getByRole('button', { name: 'Continuar editando' }).click()
    await expect(page.getByLabel('Raio de entrega')).toHaveValue('50')

    await page.getByRole('group', { name: 'Mercado' }).getByRole('button', { name: 'EUA' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Descartar e trocar' }).click()
    await expect(page.getByRole('group', { name: 'Mercado' }).getByRole('button', { name: 'EUA' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('heading', { name: 'Modo de cotação' })).toBeVisible()
    expect(captured.some((item) => item.method === 'PUT' && item.path === '/api/v1/admin/shipping/settings')).toBe(false)
  })

  test('an operator without shipping.write lands on the simulator with no save controls', async ({ page }) => {
    await openAuthed(page, '/config/shipping', e2eProfiles.operator)

    await expect(page.getByRole('tab', { name: /Simulador/ })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('group', { name: 'Mercado' })).toHaveCount(0)
    await page.getByRole('tab', { name: /Regras de entrega/ }).click()
    await expect(page.getByRole('button', { name: /Salvar regras/ })).toHaveCount(0)
  })
})
