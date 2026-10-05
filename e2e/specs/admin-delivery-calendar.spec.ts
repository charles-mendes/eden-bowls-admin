import { expect, test, type Page } from '@playwright/test'
import { e2eProfiles, openAuthed } from '../helpers/mockAdminApi'

async function openYear(page: Page, profile = e2eProfiles.operatorWrite) {
  const mocks = await openAuthed(page, '/operations/delivery-calendar', profile)
  await expect(page.getByRole('heading', { name: 'Calendário de entregas' })).toBeVisible()
  await page.getByLabel('Ano').selectOption('2027')
  await expect(page.getByRole('cell', { name: 'Natal', exact: true })).toBeVisible()
  return mocks
}

async function draftClosure(page: Page, { type = 'adhoc', date, label }: { type?: string; date: string; label: string }) {
  await page.getByRole('button', { name: 'Novo fechamento' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Tipo').selectOption(type)
  await dialog.getByLabel('Data').fill(date)
  await dialog.getByLabel('Rótulo').fill(label)
  await dialog.getByRole('button', { name: 'Ver entregas afetadas' }).click()
  return dialog
}

test.describe('Admin delivery calendar', () => {
  test('lists the Brazil year with the national holidays', async ({ page }) => {
    const { captured } = await openYear(page)
    await expect(page.getByRole('cell', { name: 'Carnaval (segunda)', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Nacional' }).first()).toBeVisible()
    await expect(page.getByLabel('Mercado')).toBeDisabled()
    await expect.poll(() => captured.some((item) => (
      item.method === 'GET' && item.path === '/api/v1/admin/delivery-calendar' && item.search === '?market=BR&year=2027'
    ))).toBe(true)
  })

  test('creates a closure after previewing the moved deliveries, and records it', async ({ page }) => {
    const { captured } = await openYear(page)
    const dialog = await draftClosure(page, { type: 'regional', date: '2027-03-29', label: 'Aniversário de Curitiba' })
    await expect(dialog.getByText('Cobrança movida no Stripe')).toBeVisible()
    await expect(dialog.getByText('Só o dia de preparo muda')).toBeVisible()
    await dialog.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Calendário salvo. 2 entrega(s) remarcada(s).')).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Aniversário de Curitiba', exact: true }).first()).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Inclusão' })).toBeVisible()
    await expect(page.getByText(/sub_ana: .* · Cobrança movida no Stripe/)).toBeVisible()
    expect(captured.some((item) => item.method === 'POST' && item.path === '/api/v1/admin/delivery-calendar')).toBe(true)
  })

  test('a locked delivery blocks the closure', async ({ page }) => {
    const { captured } = await openYear(page)
    const dialog = await draftClosure(page, { date: '2027-03-30', label: 'Falta de energia' })
    await expect(dialog.getByText('Travada (em produção)')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Salvar' })).toBeDisabled()
    expect(captured.some((item) => item.method === 'POST' && item.path === '/api/v1/admin/delivery-calendar')).toBe(false)
  })

  test('removing an ad hoc closure on a national holiday keeps the holiday', async ({ page }) => {
    await openYear(page)
    const dialog = await draftClosure(page, { date: '2027-12-25', label: 'Inventário' })
    await expect(dialog.getByText('Nenhuma entrega é afetada por esta mudança.')).toBeVisible()
    await dialog.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByRole('cell', { name: 'Inventário', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Remover Natal' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Remover Inventário' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Remover' }).click()
    await expect(page.getByText('Inventário removido.')).toBeVisible()
    await expect(page.getByRole('row').filter({ hasText: 'Inventário' }).filter({ hasText: 'Pontual' })).toHaveCount(0)
    await expect(page.getByRole('cell', { name: 'Natal', exact: true })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Remoção' })).toBeVisible()
  })

  test('resends a conflict after showing the found and target dates', async ({ page }) => {
    const { captured } = await openYear(page)
    const conflict = page.getByRole('row').filter({ hasText: 'sub_late' })
    await expect(conflict.getByText('Conflito')).toBeVisible()
    await conflict.getByRole('button', { name: 'Reenviar' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Encontrada no Stripe', { exact: true })).toBeVisible()
    await expect(dialog.getByText('Data alvo', { exact: true })).toBeVisible()
    await expect(dialog.getByText(/Reenviar substitui o valor que está no Stripe/)).toBeVisible()
    await dialog.getByRole('button', { name: 'Reenviar' }).click()
    await expect(page.getByText('Sincronização de sub_late reenviada.')).toBeVisible()
    const resend = captured.find((item) => item.method === 'POST' && item.path === '/api/v1/admin/delivery-calendar/syncs/11/resend')
    expect(resend?.body).toEqual({ market: 'BR', foundTrialEnd: '2027-02-15T03:00:00.000Z' })
    await expect(page.getByRole('cell', { name: 'Reenvio ao Stripe' })).toBeVisible()
  })

  test('warns about the missing UPS year in the United States', async ({ page }) => {
    await openAuthed(page, '/operations/delivery-calendar', e2eProfiles.admin)
    await page.getByLabel('Mercado').selectOption('US')
    await expect(page.getByRole('alert', { name: 'Calendário UPS' })).toContainText('O calendário UPS de 2028 ainda não foi cadastrado.')
  })
})
