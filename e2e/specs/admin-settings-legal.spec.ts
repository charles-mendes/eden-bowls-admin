import { expect, test, type Page } from '@playwright/test'
import { installAdminApiMocks } from '../helpers/mockAdminApi'

// The visual editor of the privacy policy and terms of use (LegalEditor): it opens the published Markdown, edits it
// as rich text and publishes Markdown in the same style.
const PUBLISHED = [
  '## Vigência',
  '',
  'Esta política vale a partir de **24 de agosto de 2026**, em [edenbowls.com.br](https://www.edenbowls.com.br).',
  '',
  '---',
  '',
  '## Dados que coletamos',
  '',
  '- Nome e e-mail.',
  '- Endereço de entrega.',
  '',
  '| Tipo | Exemplos |',
  '|---|---|',
  '| Necessários | Sessão e login |',
  '',
].join('\n')

const operatorBr = {
  userId: 'u-operator-br',
  email: 'ops.br@edenbowls.com',
  roles: ['operator'],
  markets: ['BR' as const],
  permissions: ['settings.read', 'legal.write', 'market.br'],
}

async function openPrivacy(page: Page) {
  const published: Array<{ market: string; version: string; body_markdown: string }> = []
  await installAdminApiMocks(page, { profile: operatorBr })
  await page.route('**/api/v1/admin/legal/privacy**', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as { market: string; version: string; body_markdown: string }
      published.push(body)
      return route.fulfill({ json: { market: 'BR', kind: 'privacy', current: { version: body.version, published_at: '2026-11-15T12:00:00.000Z', body_markdown: body.body_markdown }, versions: [] } })
    }
    if (new URL(route.request().url()).pathname.endsWith('/versions/2026-09-13')) {
      return route.fulfill({ json: { market: 'BR', kind: 'privacy', version: '2026-09-13', published_at: '2026-09-13T12:00:00.000Z', body_markdown: PUBLISHED } })
    }
    return route.fulfill({ json: { market: 'BR', kind: 'privacy', current: { version: '2026-09-13', published_at: '2026-09-13T12:00:00.000Z', body_markdown: PUBLISHED }, versions: [{ version: '2026-09-13', published_at: '2026-09-13T12:00:00.000Z', published_by: 1 }] } })
  })
  await page.addInitScript(() => localStorage.setItem('eden-bowls-admin-token', 'e2e-access-token'))
  await page.goto('/config?aba=legal&documento=privacy')
  await expect(page.getByRole('textbox', { name: 'Texto' })).toBeVisible()
  return published
}

test.describe('Admin legal documents editor', () => {
  test('the BR operator edits the privacy policy as rich text and publishes Markdown in the same style', async ({ page }) => {
    const published = await openPrivacy(page)
    const editor = page.getByRole('textbox', { name: 'Texto' })

    await expect(editor.getByRole('heading', { name: 'Vigência' })).toBeVisible()
    await expect(editor.locator('strong', { hasText: '24 de agosto de 2026' })).toBeVisible()
    await expect(editor.getByRole('link', { name: 'edenbowls.com.br' })).toBeVisible()
    await expect(editor.getByText('Necessários')).toBeVisible()

    await editor.getByText('Endereço de entrega.').click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Telefone.')

    await page.getByRole('button', { name: 'Publicar versão' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmar publicação' }).click()
    await expect(page.getByRole('status')).toContainText('publicada em Brasil')

    expect(published).toHaveLength(1)
    const markdown = published[0].body_markdown
    expect(published[0].market).toBe('BR')
    expect(markdown).toContain('- Endereço de entrega.\n- Telefone.')
    expect(markdown).toContain('**24 de agosto de 2026**')
    expect(markdown).toContain('[edenbowls.com.br](https://www.edenbowls.com.br)')
    expect(markdown).toMatch(/^---$/m)
    expect(markdown).toMatch(/^\| Necessários +\| Sessão e login +\|$/m)
  })

  test('shows the Markdown of the text in the Markdown mode', async ({ page }) => {
    await openPrivacy(page)

    await page.getByRole('radio', { name: 'Markdown' }).click()

    await expect(page.locator('.legal-editor .cm-content')).toContainText('## Dados que coletamos')
  })

  test('reads an earlier version formatted or as Markdown', async ({ page }) => {
    await openPrivacy(page)

    await page.getByRole('button', { name: 'Ler versão de 13/09/2026' }).click()
    const dialog = page.getByRole('dialog', { name: 'Política de privacidade de 13/09/2026' })
    const text = dialog.locator('.legal-preview .legal-editor-content')

    await expect(text.getByRole('heading', { name: 'Vigência' })).toBeVisible()
    await expect(text.getByText('Necessários')).toBeVisible()
    await expect(text).toHaveAttribute('contenteditable', 'false')
    await expect(dialog.locator('.legal-editor-toolbar')).toHaveCount(0)

    await dialog.getByRole('button', { name: 'Markdown' }).click()
    await expect(dialog.locator('pre.legal-text')).toContainText('## Dados que coletamos')
  })

  test('switching between Visual and Markdown neither resizes the dialog nor shows it empty', async ({ page }) => {
    await openPrivacy(page)
    await page.getByRole('button', { name: 'Ler versão de 13/09/2026' }).click()
    const dialog = page.getByRole('dialog', { name: 'Política de privacidade de 13/09/2026' })
    await expect(dialog.locator('.legal-preview .legal-editor-content').getByRole('heading', { name: 'Vigência' })).toBeVisible()

    for (const target of ['Markdown', 'Visual', 'Markdown', 'Visual']) {
      // Every animation frame during the switch: the dialog's height and position, and whether some text shows.
      await page.evaluate(() => {
        const probe = window as unknown as { frames: Array<{ height: number; top: number; text: number }>; done: boolean }
        probe.frames = []
        probe.done = false
        const tick = () => {
          const panel = document.querySelector('.dialog-panel')!.getBoundingClientRect()
          const shown = [...document.querySelectorAll('.legal-reader-view')].filter((view) => !(view as HTMLElement).hidden)
          probe.frames.push({ height: Math.round(panel.height), top: Math.round(panel.top), text: shown.reduce((total, view) => total + (view.textContent || '').length, 0) })
          if (!probe.done) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      })
      await dialog.getByRole('button', { name: target }).click()
      await expect(dialog.getByRole('button', { name: target })).toHaveAttribute('aria-pressed', 'true')
      await page.waitForTimeout(300)
      const frames = await page.evaluate(() => {
        const probe = window as unknown as { frames: Array<{ height: number; top: number; text: number }>; done: boolean }
        probe.done = true
        return probe.frames
      })

      expect(frames.length).toBeGreaterThan(3)
      expect(new Set(frames.map((frame) => frame.height)).size).toBe(1)
      expect(new Set(frames.map((frame) => frame.top)).size).toBe(1)
      expect(frames.every((frame) => frame.text > 0)).toBe(true)
    }
  })
})
