import { apiRequest, ApiRequestError } from './api'

// delivery-instructions: same rule as the API. Optional, one line, at most 200 characters counted as code
// points (an emoji is one), no control characters.
export const DELIVERY_INSTRUCTIONS_MAX_LENGTH = 200

export type DeliveryInstructionsSource = 'subscription' | 'profile' | null

export function oneLineInstructions(value: string): string {
  return value.replace(/[\r\n]+/g, ' ')
}

export function normalizeDeliveryInstructions(value: string | null | undefined): string {
  return String(value ?? '').trim().replace(/\s+/g, ' ')
}

export function deliveryInstructionsLength(value: string | null | undefined): number {
  return [...normalizeDeliveryInstructions(value)].length
}

export function isValidDeliveryInstructions(value: string | null | undefined): boolean {
  const text = normalizeDeliveryInstructions(value)
  // eslint-disable-next-line no-control-regex
  return [...text].length <= DELIVERY_INSTRUCTIONS_MAX_LENGTH && !/[\u0000-\u001f\u007f-\u009f]/.test(text)
}

// Where the shown text comes from: the subscription itself, or the profile copy at the same place.
export function instructionsSourceText(source: DeliveryInstructionsSource | undefined): string {
  if (source === 'subscription') return 'da assinatura'
  if (source === 'profile') return 'do perfil, mesmo endereço'
  return ''
}

export const DELIVERY_INSTRUCTIONS_ERROR = `Use no máximo ${DELIVERY_INSTRUCTIONS_MAX_LENGTH} caracteres, em uma linha.`

export async function saveSubscriptionInstructions(token: string, subscriptionId: string | number, text: string) {
  const response = await apiRequest<{ success: boolean; data: { subscription_id: string; delivery_instructions: string | null } }>(
    `/admin/billing/subscriptions/${subscriptionId}/delivery-instructions`,
    { token, method: 'PATCH', body: { delivery_instructions: text } },
  )
  return response.data
}

export function deliveryInstructionsError(error: unknown): string {
  if (error instanceof ApiRequestError && error.status === 422) return DELIVERY_INSTRUCTIONS_ERROR
  return error instanceof Error ? error.message : 'Falha ao salvar as instruções.'
}
