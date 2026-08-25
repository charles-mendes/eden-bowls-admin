export type FeedbackCategory = 'tutor' | 'tutora'
export type FeedbackCountry = 'BR' | 'US'

export type FeedbackItem = {
  id: number
  name: string
  category: FeedbackCategory | string
  country: FeedbackCountry | string
  place: string
  photo: string
  comment: string
  active: boolean
  createdAt: string | null
  updatedAt: string | null
}

export type FeedbacksResponse = {
  total: number
  page: number
  perPage: number
  totalPages: number
  items: FeedbackItem[]
}

export type FeedbackPhotoPayload = {
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp'
  imageBase64: string
}

const PHOTO_MIME_TYPES: Record<string, FeedbackPhotoPayload['mimeType']> = {
  'image/png': 'image/png',
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/webp': 'image/webp',
}

export async function fileToFeedbackPhoto(file: File): Promise<FeedbackPhotoPayload> {
  const mimeType = PHOTO_MIME_TYPES[file.type]
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
