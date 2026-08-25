import { expect, test } from '@playwright/test'
import { e2eProfiles, openAuthed } from '../helpers/mockAdminApi'

test.describe('Admin feedbacks', () => {
  test('loads the feedback list without country filter', async ({ page }) => {
    const { captured } = await openAuthed(page, '/feedbacks', e2eProfiles.operator)

    await expect(page.getByRole('heading', { name: 'Feedbacks', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'João Silva' })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'País' })).toHaveValue('')
    await expect.poll(() => captured.some((item) => (
      item.method === 'GET'
      && item.path === '/api/v1/admin/feedbacks'
      && item.search.includes('page=1')
      && !item.search.includes('country=')
      && item.authorization === 'Bearer e2e-access-token'
    ))).toBe(true)
  })

  test('filters by Brazil and creates a feedback', async ({ page }) => {
    const { captured } = await openAuthed(page, '/feedbacks', e2eProfiles.operatorWrite)

    await page.getByRole('combobox', { name: 'País' }).selectOption('BR')
    await expect.poll(() => captured.some((item) => (
      item.method === 'GET'
      && item.path === '/api/v1/admin/feedbacks'
      && item.search.includes('country=BR')
    ))).toBe(true)

    await page.getByRole('link', { name: 'Novo feedback' }).click()
    await expect(page.getByRole('heading', { name: 'Novo feedback' })).toBeVisible()
    await page.getByPlaceholder('Nome do cliente').fill('Maria Souza')
    await page.getByRole('combobox', { name: 'Categoria' }).selectOption('tutora')
    await page.getByPlaceholder('Nova York, São Paulo').fill('São Paulo')
    await page.getByRole('textbox', { name: 'Comentário' }).fill('Comida fresca de verdade.')
    await page.getByRole('button', { name: 'Salvar' }).click()

    await expect.poll(() => captured.find((item) => item.method === 'POST' && item.path === '/api/v1/admin/feedbacks')).toMatchObject({
      authorization: 'Bearer e2e-access-token',
      body: {
        name: 'Maria Souza',
        category: 'tutora',
        country: 'BR',
        place: 'São Paulo',
        comment: 'Comida fresca de verdade.',
        active: true,
      },
    })
    await expect(page.getByRole('heading', { name: 'Feedbacks', exact: true })).toBeVisible()
  })

  test('edits and deactivates a feedback', async ({ page }) => {
    const edit = await openAuthed(page, '/feedbacks/1', e2eProfiles.operatorWrite)

    await expect(page.getByDisplayValue('João Silva')).toBeVisible()
    await page.getByPlaceholder('Nome do cliente').fill('João Silva Jr')
    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect.poll(() => edit.captured.find((item) => item.method === 'PATCH' && item.path === '/api/v1/admin/feedbacks/1')).toMatchObject({
      body: { name: 'João Silva Jr' },
    })

    const list = await openAuthed(page, '/feedbacks', e2eProfiles.operatorWrite)
    await expect(page.getByRole('link', { name: 'Editar feedback João Silva' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Desativar' })).toHaveCount(0)

    await page.getByRole('link', { name: 'Editar feedback João Silva' }).click()
    await expect(page.getByRole('heading', { name: 'Editar feedback' })).toBeVisible()
    await page.getByRole('button', { name: 'Desativar' }).click()
    await expect.poll(() => list.captured.some((item) => (
      item.method === 'PATCH'
      && item.path === '/api/v1/admin/feedbacks/1/active'
      && (item.body as { active?: boolean } | null)?.active === false
    ))).toBe(true)
  })
})
