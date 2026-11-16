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
// A close size is accepted and the API resizes it (cover, centre crop): at most 25% of enlargement
// and at most 15% of the width or height cut off. Same rule as the API.
export const RECIPE_IMAGE_MAX_UPSCALE = 1.25
export const RECIPE_IMAGE_MAX_CROP = 0.15
// Smallest image the enlargement limit allows: 820 × 509 px.
export const RECIPE_IMAGE_MIN_WIDTH = Math.ceil(RECIPE_IMAGE_WIDTH / RECIPE_IMAGE_MAX_UPSCALE)
export const RECIPE_IMAGE_MIN_HEIGHT = Math.ceil(RECIPE_IMAGE_HEIGHT / RECIPE_IMAGE_MAX_UPSCALE)
export const MAX_RECIPE_IMAGE_BYTES = 5 * 1024 * 1024
// Square package thumbnail of the plan flavor picker: 400 px for retina screens, or 200 px.
export const RECIPE_PLAN_IMAGE_SIZES = [400, 200]

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

export function recipeBannerFits(width: number, height: number) {
  const scale = Math.max(RECIPE_IMAGE_WIDTH / width, RECIPE_IMAGE_HEIGHT / height)
  const crop = Math.max(1 - RECIPE_IMAGE_WIDTH / (width * scale), 1 - RECIPE_IMAGE_HEIGHT / (height * scale))
  return Number.isFinite(scale) && scale <= RECIPE_IMAGE_MAX_UPSCALE + 1e-9 && crop <= RECIPE_IMAGE_MAX_CROP + 1e-9
}

export const RECIPE_BANNER_SIZE_TEXT =
  `${RECIPE_IMAGE_WIDTH} × ${RECIPE_IMAGE_HEIGHT} px, ou um tamanho próximo (proporção parecida e pelo menos ${RECIPE_IMAGE_MIN_WIDTH} × ${RECIPE_IMAGE_MIN_HEIGHT} px), que é ajustado automaticamente`

export type RecipeImageCheck =
  | { ok: true; width: number; height: number }
  | { ok: false; message: string }

function sizesText(sizes: Array<{ width: number; height: number }>) {
  return sizes.map(({ width, height }) => `${width} × ${height} px`).join(' ou ')
}

// Type, weight and size, checked before any upload so a wrong file never leaves the browser.
export function checkRecipeImage(file: File, readSize = readImageSize): Promise<RecipeImageCheck> {
  return checkImage(file, (size) => recipeBannerFits(size.width, size.height) ? null : RECIPE_BANNER_SIZE_TEXT, readSize)
}

export function checkRecipePlanImage(file: File, readSize = readImageSize): Promise<RecipeImageCheck> {
  const sizes = RECIPE_PLAN_IMAGE_SIZES.map((side) => ({ width: side, height: side }))
  return checkImage(
    file,
    (size) => sizes.some(({ width, height }) => size.width === width && size.height === height) ? null : sizesText(sizes),
    readSize,
  )
}

// refusedSize returns the expected size text when the size is refused, or null when it is accepted.
async function checkImage(
  file: File,
  refusedSize: (size: { width: number; height: number }) => string | null,
  readSize: (file: File) => Promise<{ width: number; height: number }>,
): Promise<RecipeImageCheck> {
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
  const expected = refusedSize(size)
  if (expected) {
    return { ok: false, message: `A imagem tem ${size.width} × ${size.height} px e precisa ter ${expected}.` }
  }
  return { ok: true, ...size }
}
