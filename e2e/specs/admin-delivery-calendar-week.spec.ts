import { expect, test, type Page } from '@playwright/test'
import { e2eProfiles, openAuthed } from '../helpers/mockAdminApi'

// Semana padrão (delivery-calendar): the operator previews a change of the week, then saves it with the moves seen.
async function openWeek(page: Page, profile = e2eProfiles.operatorWrite) {
  const mocks = await openAuthed(page, '/operations/delivery-calendar', profile)
  await expect(page.getByRole('heading', { name: 'Calendário de operação' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Semana padrão' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('switch', { name: 'Sábado aberto' })).toBeChecked()
  return mocks
}

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}

test.describe('Admin standard week', () => {
  test('closing Saturday shows each delivery outcome, then saves with the moves of the preview', async ({ page }, testInfo) => {
    const { captured } = await openWeek(page)
    const save = page.getByRole('button', { name: 'Salvar semana' })
    await expect(save).toBeDisabled()

    await page.getByRole('switch', { name: 'Sábado aberto' }).click({ force: true })
    await expect(page.getByText('Veja o impacto antes de salvar.')).toBeVisible()
    await page.getByRole('button', { name: 'Ver impacto' }).click()

    const table = page.getByRole('table', { name: 'Entregas afetadas' })
    await expect(table.getByRole('row', { name: /sub_ana/ })).toContainText('Muda para 25/01/2027 (seg)')
    await expect(table.getByRole('row', { name: /sub_bia/ })).toContainText('Cobrança mantida, preparo muda para 25/01/2027 (seg)')
    await expect(table.getByRole('row', { name: /sub_cris/ })).toContainText('Mantém a data')
    await expect(save).toBeEnabled()

    await page.screenshot({ path: testInfo.outputPath('week-preview-1440.png'), fullPage: true })
    await noHorizontalScroll(page)

    await save.click()
    await expect(page.getByText('Semana padrão salva.')).toBeVisible()
    const put = captured.find((item) => item.method === 'PUT' && item.path === '/api/v1/admin/delivery-calendar/week')
    expect(put?.body).toMatchObject({
      market: 'BR',
      confirmedMoves: [
        { stripeSubscriptionId: 'sub_ana', deliveryId: 'current', newPreparationDay: '2027-01-25' },
        { stripeSubscriptionId: 'sub_bia', deliveryId: 'current', newPreparationDay: '2027-01-25' },
      ],
    })

    await page.getByRole('tab', { name: /Histórico/ }).click()
    const history = page.getByRole('tabpanel', { name: /Histórico/ })
    await expect(history.getByRole('cell', { name: 'Semana padrão' })).toBeVisible()
    await expect(history.getByRole('cell', { name: 'seg–sex 09:00–20:00' })).toBeVisible()
  })

  test('a save whose impact changed asks for a new preview', async ({ page }) => {
    await openWeek(page)
    await page.route('**/api/v1/admin/delivery-calendar/week', async (route) => {
      if (route.request().method() !== 'PUT') return route.fallback()
      return route.fulfill({ status: 409, json: { message: 'As entregas afetadas mudaram desde a prévia. Veja o impacto de novo.', details: { code: 'week_impact_changed' } } })
    })
    await page.getByRole('switch', { name: 'Sábado aberto' }).click({ force: true })
    await page.getByRole('button', { name: 'Ver impacto' }).click()
    await page.getByRole('button', { name: 'Salvar semana' }).click()

    await expect(page.getByRole('alert')).toContainText('As entregas afetadas mudaram desde a prévia')
    await expect(page.getByRole('button', { name: 'Salvar semana' })).toBeDisabled()
    await expect(page.getByRole('table', { name: 'Entregas afetadas' })).toHaveCount(0)
  })

  test('changing only the hours previews nothing to move', async ({ page }) => {
    await openWeek(page)
    await page.getByRole('textbox', { name: 'Segunda fecha' }).fill('18:00')
    await page.getByRole('button', { name: 'Ver impacto' }).click()
    await expect(page.getByText('Nenhuma entrega agendada muda. A semana vale para os pagamentos a partir de agora.')).toBeVisible()
  })

  test('fits a phone without horizontal scroll, the United States note included', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openAuthed(page, '/operations/delivery-calendar', e2eProfiles.admin)
    await expect(page.getByRole('switch', { name: 'Sábado aberto' })).toBeChecked()
    await page.screenshot({ path: testInfo.outputPath('week-br-390.png'), fullPage: true })
    await noHorizontalScroll(page)

    await page.getByLabel('Mercado').selectOption('US')
    await expect(page.getByText(/sexta e sábado nunca preparam/)).toBeVisible()
    await expect(page.getByRole('switch', { name: 'Sábado aberto' })).not.toBeChecked()
    await page.screenshot({ path: testInfo.outputPath('week-us-390.png'), fullPage: true })
    await noHorizontalScroll(page)
  })
})
