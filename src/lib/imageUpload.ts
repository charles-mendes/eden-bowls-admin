export type ImagePayload = {
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp'
  imageBase64: string
}

const IMAGE_MIME_TYPES: Record<string, ImagePayload['mimeType']> = {
  'image/png': 'image/png',
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/webp': 'image/webp',
}

// Mirrors the API rule (recipe-content): the size of the store recipe banner.
export const RECIPE_IMAGE_WIDTH = 1024
export const RECIPE_IMAGE_HEIGHT = 636
export const MAX_RECIPE_IMAGE_BYTES = 5 * 1024 * 1024

export function imageMimeType(file: File) {
  return IMAGE_MIME_TYPES[file.type] ?? null
}

export async function fileToImagePayload(file: File): Promise<ImagePayload> {
  const mimeType = imageMimeType(file)
  if (!mimeType) {
    throw new Error('Use uma imagem PNG, JPEG ou WebP.')
  }

  const imageBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(new Error('Falha ao ler a imagem.'))
    reader.readAsDataURL(file)
  })

  if (!imageBase64) {
    throw new Error('Falha ao ler a imagem.')
  }

  return { mimeType, imageBase64 }
}

export function readImageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: image.naturalWidth, height: image.naturalHeight })
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Não foi possível abrir a imagem.'))
    }
    image.src = url
  })
}

function megabytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
}

export type RecipeImageCheck =
  | { ok: true; width: number; height: number }
  | { ok: false; message: string }

// Type, weight and exact size, checked before any upload so a wrong file never leaves the browser.
export async function checkRecipeImage(file: File, readSize = readImageSize): Promise<RecipeImageCheck> {
  if (!imageMimeType(file)) {
    return { ok: false, message: `Use uma imagem PNG, JPEG ou WebP. Este arquivo é ${file.type || 'de tipo desconhecido'}.` }
  }
  if (file.size > MAX_RECIPE_IMAGE_BYTES) {
    return { ok: false, message: `A imagem tem ${megabytes(file.size)} e o limite é 5 MB.` }
  }
  let size: { width: number; height: number }
  try {
    size = await readSize(file)
  } catch {
    return { ok: false, message: 'Não foi possível abrir a imagem. Escolha outro arquivo.' }
  }
  if (size.width !== RECIPE_IMAGE_WIDTH || size.height !== RECIPE_IMAGE_HEIGHT) {
    return {
      ok: false,
      message: `A imagem tem ${size.width} × ${size.height} px e precisa ter ${RECIPE_IMAGE_WIDTH} × ${RECIPE_IMAGE_HEIGHT} px.`,
    }
  }
  return { ok: true, ...size }
}
