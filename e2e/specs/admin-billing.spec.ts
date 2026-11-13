import { expect, test } from '@playwright/test'
import { e2eProfiles, openAuthed } from '../helpers/mockAdminApi'

test.describe('Admin billing', () => {
  test('loads the subscriber list', async ({ page }) => {
    const { captured } = await openAuthed(page, '/billing', e2eProfiles.operatorWrite)

    await expect(page.getByRole('heading', { name: 'Assinantes' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'sub_123' })).toBeVisible()
    await expect(page.getByLabel('Conta')).toHaveValue('br')
    await expect(page.getByLabel('Conta')).toBeDisabled()
    await expect(page.getByLabel('Conta').getByRole('option', { name: 'todas' })).toHaveCount(0)
    await expect(page.getByLabel('Conta').getByRole('option', { name: 'US' })).toHaveCount(0)
    await expect.poll(() => captured.some((item) => (
      item.method === 'GET'
      && item.path === '/api/v1/admin/billing/subscriptions'
      && item.search.includes('account=br')
      && !item.search.includes('account=us')
    ))).toBe(true)
  })

  test('starts a catalog sync from the products page', async ({ page }) => {
    const { captured } = await openAuthed(page, '/catalog/products', e2eProfiles.operatorWrite)

    await expect(page.getByRole('button', { name: 'Sincronizar catálogo' })).toBeVisible()
    await page.getByRole('button', { name: 'Sincronizar catálogo' }).click()
    await expect(page.getByText('Sincronização: na fila')).toBeVisible()
    await expect.poll(() => captured.find((item) => item.method === 'POST' && item.path === '/api/v1/admin/catalog/sync')).toMatchObject({
      authorization: 'Bearer e2e-access-token',
      body: { market: 'BR', currency: 'BRL' },
    })
  })

  test('loads customer subscription detail', async ({ page }) => {
    await openAuthed(page, '/billing/subscriptions/sub-row-1', e2eProfiles.operatorWrite)

    await expect(page.getByRole('heading', { name: 'ana@edenbowls.com' })).toBeVisible()
    await expect(page.getByText('ana@edenbowls.com', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Invoices Eden Bowls' })).toBeVisible()
    await expect(page.getByText('EB-2026-000418')).toBeVisible()
    await expect(page.getByText('Enviada', { exact: true })).toBeVisible()
    await expect(page.getByText(/para ana@edenbowls\.com/)).toBeVisible()
  })

  // delivery-instructions: the profile text shows with its source; the operator writes the subscription text.
  test('writes the delivery instructions of a subscription', async ({ page }) => {
    if (process.env.CAPTURE_WIDTH) await page.setViewportSize({ width: Number(process.env.CAPTURE_WIDTH), height: 900 })
    const { captured } = await openAuthed(page, '/billing/subscriptions/sub-row-1', e2eProfiles.operatorWrite)

    const section = page.locator('section.section-card', { has: page.getByRole('heading', { name: 'Instruções de entrega' }) })
    await expect(section.getByText('Interfone 12')).toBeVisible()
    await expect(section.getByText('(do perfil, mesmo endereço)')).toBeVisible()
    if (process.env.CAPTURE_DIR) await section.screenshot({ path: `${process.env.CAPTURE_DIR}/instructions-profile-${page.viewportSize()?.width}.png` })
    await section.getByRole('button', { name: 'Escrever instruções' }).click()
    await section.getByLabel('Instruções desta assinatura').fill('Portão lateral, cuidado com o cachorro')
    await expect(section.getByTestId('subscription-instructions-counter')).toHaveText('38/200')
    if (process.env.CAPTURE_DIR) await section.screenshot({ path: `${process.env.CAPTURE_DIR}/instructions-form-${page.viewportSize()?.width}.png` })
    await section.getByRole('button', { name: 'Salvar instruções' }).click()
    await expect(page.getByText('Instruções da assinatura salvas.')).toBeVisible()
    await expect(section.getByText('(da assinatura)')).toBeVisible()
    await expect.poll(() => captured.find((item) => item.method === 'PATCH' && item.path.endsWith('/delivery-instructions'))?.body)
      .toEqual({ delivery_instructions: 'Portão lateral, cuidado com o cachorro' })
    if (process.env.CAPTURE_DIR) await page.screenshot({ path: `${process.env.CAPTURE_DIR}/instructions-saved-${page.viewportSize()?.width}.png`, fullPage: true })
  })

  test('syncs first-purchase coupons with Stripe', async ({ page }) => {
    const { captured } = await openAuthed(page, '/billing/coupons', e2eProfiles.operatorWrite)

    await expect(page.getByRole('heading', { name: 'Cupons de 1ª compra' })).toBeVisible()
    await expect(page.getByRole('article', { name: 'Prazo 1 mês' }).getByText('promo_1m')).toBeVisible()
    await expect(page.getByText(/Slots também definidos via env/)).toHaveCount(0)
    await expect(page.getByLabel('Conta')).toHaveValue('br')
    await expect(page.getByLabel('Conta')).toBeDisabled()
    await expect.poll(() => captured.some((item) => (
      item.method === 'GET'
      && item.path === '/api/v1/admin/stripe/first-purchase-promos'
      && item.search.includes('account=br')
    ))).toBe(true)

    await page.getByRole('button', { name: 'Sincronizar com Stripe' }).click()
    await expect(page.getByText('Mapa sincronizado com a Stripe.')).toBeVisible()
    await expect.poll(() => captured.find((item) => item.method === 'POST' && item.path === '/api/v1/admin/stripe/first-purchase-promos/sync')).toMatchObject({
      authorization: 'Bearer e2e-access-token',
      search: '?account=br',
    })
  })

  test('creates a first-purchase coupon in Stripe from a term card', async ({ page }) => {
    const { captured } = await openAuthed(page, '/billing/coupons', e2eProfiles.operatorWrite)

    await page.getByRole('button', { name: 'Substituir cupom de 6 meses' }).click()
    const dialog = page.getByRole('dialog', { name: 'Criar cupom na Stripe' })
    await expect(dialog.getByLabel('Prazo')).toHaveValue('6')
    await dialog.getByLabel('Código').fill('bemvindo40')
    await dialog.getByRole('button', { name: 'Criar na Stripe' }).click()

    await expect(page.getByText('Cupom criado na Stripe e gravado no banco.')).toBeVisible()
    await expect(dialog).toHaveCount(0)
    await expect.poll(() => captured.find((item) => item.method === 'POST' && item.path === '/api/v1/admin/stripe/first-purchase-coupons')?.body).toMatchObject({
      term_months: 6,
      code: 'BEMVINDO40',
      assign_first_purchase_slot: true,
      account: 'br',
    })
  })

  test('fits a phone screen without sideways scroll', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await openAuthed(page, '/billing/coupons', e2eProfiles.operatorWrite)

    await expect(page.getByRole('article', { name: 'Prazo 6 meses' })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
