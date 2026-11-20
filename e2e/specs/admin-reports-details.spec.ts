import { expect, test } from '@playwright/test'
import { e2eProfiles, openAuthed } from '../helpers/mockAdminApi'

const REPORTS = '/reports?aba=receita&mercado=US&de=2026-10-20&ate=2026-11-18'

test.describe('Admin report details', () => {
  // The panel has a single (light) theme.
  for (const scheme of ['light'] as const) {
    test(`a card opens its details and "Voltar" keeps the filters (${scheme})`, async ({ page }) => {
      const { captured } = await openAuthed(page, REPORTS, e2eProfiles.reports)

      await page.getByRole('link', { name: /Faturamento bruto/ }).first().click()
      await expect(page).toHaveURL(/\/reports\/detalhe\?aba=receita&indicador=grossRevenue&mercado=US&de=2026-10-20&ate=2026-11-18/)
      await expect(page.getByRole('heading', { name: 'Faturamento bruto' })).toBeVisible()
      await expect(page.getByText('Confere com o relatório')).toBeVisible()
      const records = page.getByRole('table', { name: 'Registros do indicador' })
      await expect(records.getByRole('link', { name: 'EB-2026-000001' })).toBeVisible()
      await expect(records.getByRole('link', { name: 'Ana Souza' })).toBeVisible()
      await page.screenshot({ path: `test-results/report-details-${scheme}.png`, fullPage: true })

      await page.getByRole('button', { name: 'Período anterior' }).click()
      await expect(records.getByRole('link', { name: 'EB-2026-000003' })).toBeVisible()
      expect(captured.some((item) => item.path === '/api/v1/admin/reports/details' && item.search.includes('period=previous'))).toBe(true)

      await page.getByRole('link', { name: '← Voltar para Relatórios' }).click()
      await expect(page).toHaveURL(/\/reports\?aba=receita&mercado=US&de=2026-10-20&ate=2026-11-18$/)
      await expect(page.getByRole('link', { name: /Faturamento bruto/ }).first()).toBeVisible()
      await page.screenshot({ path: `test-results/reports-revenue-${scheme}.png`, fullPage: true })
    })
  }
})
