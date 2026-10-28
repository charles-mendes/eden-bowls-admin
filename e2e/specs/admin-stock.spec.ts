import { expect, test } from '@playwright/test'
import { e2eProfiles, openAuthed } from '../helpers/mockAdminApi'

test.describe('Admin stock', () => {
  test('lists ready packs against the window', async ({ page }) => {
    const { captured } = await openAuthed(page, '/operations/stock', e2eProfiles.operatorWrite)

    const packs = page.locator('.section-card').filter({ has: page.getByRole('heading', { name: 'Packs' }) })
    await expect(page.getByRole('heading', { name: 'Estoque' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Estoque' })).toBeVisible()
    await expect(packs.getByRole('cell', { name: 'frango', exact: true })).toBeVisible()
    await expect(packs.getByText('10 aguardando pagamento')).toBeVisible()
    await expect(page.getByLabel('Mercado')).toHaveValue('BR')
    await expect(page.getByLabel('Mercado')).toBeDisabled()
    await expect.poll(() => captured.some((item) => (
      item.method === 'GET'
      && item.path === '/api/v1/admin/stock'
      && item.search.includes('market=BR')
    ))).toBe(true)
  })

  test('records production and reloads the row', async ({ page }) => {
    const { captured } = await openAuthed(page, '/operations/stock', e2eProfiles.operatorWrite)

    await page.getByRole('button', { name: 'Lançar produção' }).click()
    const dialog = page.getByRole('dialog', { name: 'Lançar produção' })
    await dialog.getByLabel('Receita').fill('carne')
    await dialog.getByLabel('Tamanho (g)').fill('500')
    await dialog.getByLabel('Quantidade').fill('30')
    await dialog.getByRole('button', { name: 'Lançar' }).click()

    await expect.poll(() => captured.some((item) => (
      item.method === 'POST'
      && item.path === '/api/v1/admin/stock/production'
      && (item.body as { flavorKey?: string; quantity?: number })?.flavorKey === 'carne'
      && (item.body as { quantity?: number })?.quantity === 30
    ))).toBe(true)
    const packs = page.locator('.section-card').filter({ has: page.getByRole('heading', { name: 'Packs' }) })
    await expect(packs.getByRole('row').filter({ hasText: 'carne' })).toContainText('40')
  })

  test('adjusts on-hand from the row', async ({ page }) => {
    const { captured } = await openAuthed(page, '/operations/stock', e2eProfiles.operatorWrite)

    const packs = page.locator('.section-card').filter({ has: page.getByRole('heading', { name: 'Packs' }) })
    await packs.getByRole('row').filter({ hasText: 'frango' }).getByRole('button', { name: 'Ajustar' }).click()
    const dialog = page.getByRole('dialog', { name: /Ajustar frango/ })
    await dialog.getByLabel('Quantidade').fill('-2')
    await dialog.getByLabel('Motivo').selectOption('loss')
    await dialog.getByRole('button', { name: 'Salvar' }).click()

    await expect.poll(() => captured.some((item) => (
      item.method === 'POST'
      && item.path === '/api/v1/admin/stock/adjustments'
      && (item.body as { flavorKey?: string; quantity?: number })?.flavorKey === 'frango'
      && (item.body as { quantity?: number })?.quantity === -2
    ))).toBe(true)
    await expect(packs.getByRole('row').filter({ hasText: 'frango' })).toContainText('38')
  })
})
