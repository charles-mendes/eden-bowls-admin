import { expect, test } from '@playwright/test'
import { e2eProfiles, openAuthed } from '../helpers/mockAdminApi'

test.describe('Admin readonly', () => {
  test('hides write-heavy navigation and billing mutations', async ({ page }) => {
    await openAuthed(page, '/billing', e2eProfiles.readonly)

    await expect(page.getByRole('heading', { name: 'Assinantes' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Feedbacks' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Clientes' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Checkouts' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Frete' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Cupons 1ª compra' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Papéis' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Sync catálogo' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Sincronizar agora' })).toHaveCount(0)
  })

  test('opens production queue without status-advance controls', async ({ page }) => {
    await openAuthed(page, '/operations/production', e2eProfiles.readonly)

    await expect(page.getByRole('heading', { name: 'Produção' })).toBeVisible()
    await expect(page.getByText('Ana Costa')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Em produção' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Bloquear' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Assinante', exact: true })).toBeVisible()
  })

  test('hides delivery and catalog mutations', async ({ page }) => {
    await openAuthed(page, '/users/u-ana', e2eProfiles.readonly)
    await expect(page.getByRole('heading', { name: 'ana@edenbowls.com' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Salvar instruções' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Salvar endereço' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Desativar conta' })).toHaveCount(0)

    await openAuthed(page, '/catalog/products/prod-1', e2eProfiles.readonly)
    await expect(page.getByText('BOWL-1')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Salvar' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Publicar' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Excluir produto' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Excluir variação/ })).toHaveCount(0)
  })
})
