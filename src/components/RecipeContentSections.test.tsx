import { render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RecipeContentSections } from './RecipeContentSections'
import { operatorWriteUser, readonlyUser, recipeContent } from '../test/fixtures'
import { installAdminFetchMock } from '../test/mockAdminFetch'

const imageSizes = new Map<string, { width: number; height: number }>()

vi.mock('../lib/imageUpload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/imageUpload')>()
  const size = (file: File) => {
    const found = imageSizes.get(file.name)
    if (!found) throw new Error('unknown test image')
    return found
  }
  return {
    ...actual,
    checkRecipeImage: (file: File) => actual.checkRecipeImage(file, async () => size(file)),
    checkRecipePlanImage: (file: File) => actual.checkRecipePlanImage(file, async () => size(file)),
  }
})

function png(name: string, width: number, height: number) {
  imageSizes.set(name, { width, height })
  return new File(['png-bytes'], name, { type: 'image/png' })
}

// Keeps the saved content in state, as the product page does.
function Host({ canWrite, onDirtyChange }: { canWrite: boolean; onDirtyChange: (dirty: boolean) => void }) {
  const [content, setContent] = useState(recipeContent)
  return (
    <RecipeContentSections
      token="access-token"
      market="BR"
      productId="100"
      content={content}
      canWrite={canWrite}
      onSaved={(saved) => setContent(saved as typeof recipeContent)}
      onDirtyChange={onDirtyChange}
    />
  )
}

function renderSections(canWrite = true) {
  const onDirtyChange = vi.fn()
  render(<Host canWrite={canWrite} onDirtyChange={onDirtyChange} />)
  const lastDirty = () => onDirtyChange.mock.calls.at(-1)?.[0]
  return { onDirtyChange, lastDirty }
}

describe('RecipeContentSections unsaved state', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() }))
  })

  afterEach(() => {
    imageSizes.clear()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('starts clean', () => {
    installAdminFetchMock(operatorWriteUser)
    const { onDirtyChange } = renderSections()
    expect(onDirtyChange).not.toHaveBeenCalledWith(true)
  })

  it('marks a typed label and clears it once the label is saved', async () => {
    const user = userEvent.setup()
    installAdminFetchMock(operatorWriteUser)
    const { lastDirty } = renderSections()

    await user.type(screen.getByLabelText('Fabricante'), ' Ltda')
    expect(lastDirty()).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Salvar rótulo' }))
    await waitFor(() => {
      expect(lastDirty()).toBe(false)
    })
  })

  it('marks a typed presentation and clears it when the text goes back', async () => {
    const user = userEvent.setup()
    installAdminFetchMock(operatorWriteUser)
    const { lastDirty } = renderSections()

    const title = screen.getByLabelText('Título')
    await user.type(title, 'x')
    expect(lastDirty()).toBe(true)
    await user.type(title, '{Backspace}')
    expect(lastDirty()).toBe(false)
  })

  it('marks a chosen image until it is discarded', async () => {
    const user = userEvent.setup()
    installAdminFetchMock(operatorWriteUser)
    const { lastDirty } = renderSections()

    await user.upload(screen.getByLabelText('Escolher imagem'), png('banner.png', 1024, 636))
    await screen.findByRole('img', { name: 'Prévia da nova imagem' })
    expect(lastDirty()).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Descartar' }))
    expect(lastDirty()).toBe(false)
  })

  it('marks a chosen plan thumbnail', async () => {
    const user = userEvent.setup()
    installAdminFetchMock(operatorWriteUser)
    const { lastDirty } = renderSections()

    await user.upload(screen.getByLabelText('Escolher miniatura'), png('pack.png', 400, 400))
    await screen.findByRole('img', { name: 'Prévia da nova miniatura' })
    expect(lastDirty()).toBe(true)
  })

  it('is never dirty read-only', () => {
    installAdminFetchMock(readonlyUser)
    const { onDirtyChange } = renderSections(false)
    expect(onDirtyChange).not.toHaveBeenCalledWith(true)
  })
})
