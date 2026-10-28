import { expect, test } from '@playwright/test'
import { e2eProfiles, openAuthed } from '../helpers/mockAdminApi'

test.describe('Admin readonly', () => {
  test('hides write-heavy navigation and billing mutations', async ({ page }) => {
    await openAuthed(page, '/billing', e2eProfiles.readonly)

    await expect(page.getByRole('heading', { name: 'Assinantes' })).toBeVisible()
    await expect(page.getByLabel('Conta')).toHaveValue('br')
    await expect(page.getByLabel('Conta')).toBeDisabled()
    await expect(page.getByRole('option', { name: 'US' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Hoje' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Feedbacks' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Clientes' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Checkouts' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Frete' })).toHaveAttribute('href', '/config/shipping')
    await expect(page.getByRole('link', { name: 'Cupons 1ª compra' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Equipe e papéis' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Sincronizar catálogo' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Sincronizar agora' })).toHaveCount(0)
  })

  test('opens stock without write actions', async ({ page }) => {
    await openAuthed(page, '/operations/stock', e2eProfiles.readonly)

    await expect(page.getByRole('heading', { name: 'Estoque' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'frango', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Lançar produção' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Ajustar' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Definir mínimo' })).toHaveCount(0)
  })

  test('opens production queue without status-advance controls', async ({ page }) => {
    await openAuthed(page, '/operations/production', e2eProfiles.readonly)

    await expect(page.getByRole('heading', { name: 'Fila de produção' })).toBeVisible()
    await expect(page.getByText('Ana Ledger')).toBeVisible()
    await expect(page.getByRole('group', { name: 'Mercado' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Iniciar preparo' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Mais opções para Ana Ledger' }).click()
    const menu = page.getByRole('menu')
    await expect(menu.getByRole('menuitem', { name: 'Bloquear' })).toHaveCount(0)
    await expect(menu.getByRole('menuitem', { name: 'Assinatura' })).toBeVisible()
  })

  test('opens the delivery calendar without write controls', async ({ page }) => {
    await openAuthed(page, '/operations/delivery-calendar', e2eProfiles.readonly)

    await expect(page.getByRole('heading', { name: 'Feriados e fechamentos' })).toBeVisible()
    await page.getByLabel('Ano').selectOption('2027')
    await expect(page.getByRole('cell', { name: 'Natal', exact: true })).toBeVisible()
    await expect(page.getByLabel('Mercado')).toBeDisabled()
    await expect(page.getByRole('row').filter({ hasText: 'sub_late' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Novo fechamento' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^(Editar|Desativar|Reativar|Remover)/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Reenviar' })).toHaveCount(0)
  })

  test('hides delivery and catalog mutations', async ({ page }) => {
    await openAuthed(page, '/users/u-ana', e2eProfiles.readonly)
    await expect(page.getByRole('heading', { name: 'Ana Costa' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Salvar instruções' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Salvar endereço' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Desativar conta' })).toHaveCount(0)

    await openAuthed(page, '/catalog/products', e2eProfiles.readonly)
    await expect(page.getByRole('heading', { name: 'Produtos', exact: true })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Mercado', exact: true })).toHaveValue('BR')
    await expect(page.getByRole('combobox', { name: 'Mercado', exact: true })).toBeDisabled()
    await expect(page.getByRole('option', { name: 'Estados Unidos' })).toHaveCount(0)

    await openAuthed(page, '/catalog/products/prod-1', e2eProfiles.readonly)
    await expect(page.getByText('BOWL-1')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Salvar' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Publicar' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Excluir produto' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Excluir variação/ })).toHaveCount(0)

    await page.getByRole('link', { name: 'Conteúdo da receita de Frango 1kg' }).click()
    await expect(page.getByRole('heading', { name: 'Imagem' })).toBeVisible()
    await expect(page.getByText('Escolher imagem')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Salvar imagem|Remover imagem/ })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Rótulo' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Salvar rótulo|Adicionar/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Renomear|Excluir receita/ })).toHaveCount(0)

    await openAuthed(page, '/catalog/recipes', e2eProfiles.readonly)
    await expect(page.getByRole('link', { name: 'Carne' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Nova receita' })).toHaveCount(0)
  })

  test('opens the shipping simulator and reads the rules without save controls', async ({ page }) => {
    await openAuthed(page, '/config/shipping', e2eProfiles.readonly)

    await expect(page.getByRole('tab', { name: 'Simulador de frete' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('heading', { name: 'Simular frete por CEP' })).toBeVisible()
    await page.getByRole('tab', { name: /Regras de entrega/ }).click()
    await expect(page.getByRole('heading', { name: 'Entrega local' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Salvar regras/ })).toHaveCount(0)
    await page.getByRole('tab', { name: /Sede/ }).click()
    await expect(page.getByRole('button', { name: /Salvar sede|Validar endereço/ })).toHaveCount(0)
  })
})
