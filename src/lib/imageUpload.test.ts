import { describe, expect, it } from 'vitest'
import { checkRecipeImage, fileToImagePayload } from './imageUpload'

function file(type: string, size = 1000) {
  return new File([new Uint8Array(size)], 'receita', { type })
}

const sized = (width: number, height: number) => async () => ({ width, height })

describe('checkRecipeImage', () => {
  it('accepts a 1024 × 636 PNG, JPEG or WebP', async () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
      expect(await checkRecipeImage(file(type), sized(1024, 636))).toEqual({ ok: true, width: 1024, height: 636 })
    }
  })

  it('says the received and the expected size', async () => {
    expect(await checkRecipeImage(file('image/png'), sized(2048, 1272))).toEqual({
      ok: false,
      message: 'A imagem tem 2048 × 1272 px e precisa ter 1024 × 636 px.',
    })
  })

  it('refuses another type before reading the size', async () => {
    const result = await checkRecipeImage(file('image/gif'), async () => { throw new Error('should not read') })
    expect(result).toEqual({ ok: false, message: 'Use uma imagem PNG, JPEG ou WebP. Este arquivo é image/gif.' })
  })

  it('refuses a file over 5 MB', async () => {
    const result = await checkRecipeImage(file('image/png', 6 * 1024 * 1024), sized(1024, 636))
    expect(result).toEqual({ ok: false, message: 'A imagem tem 6 MB e o limite é 5 MB.' })
  })

  it('reports an image that cannot be opened', async () => {
    const result = await checkRecipeImage(file('image/png'), async () => { throw new Error('broken') })
    expect(result).toEqual({ ok: false, message: 'Não foi possível abrir a imagem. Escolha outro arquivo.' })
  })
})

describe('fileToImagePayload', () => {
  it('sends the base64 without the data URL prefix', async () => {
    const payload = await fileToImagePayload(new File(['png'], 'a.png', { type: 'image/png' }))
    expect(payload).toEqual({ mimeType: 'image/png', imageBase64: btoa('png') })
  })
})
