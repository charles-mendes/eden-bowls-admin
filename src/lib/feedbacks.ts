import { fileToImagePayload, type ImagePayload } from './imageUpload'

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

export type FeedbackPhotoPayload = ImagePayload

export function fileToFeedbackPhoto(file: File): Promise<FeedbackPhotoPayload> {
  return fileToImagePayload(file)
}
