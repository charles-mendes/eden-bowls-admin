import { apiRequest, ApiRequestError } from './api'

// operator-fills-recipient-name: fills the missing recipient of one subscription. Only the name; nothing else of
// the address, and never a name that is already there (409 recipient_name_present).
export type FilledRecipient = {
  subscription_id: string
  recipient_name: string
  courier_issues: string[] | null
}

export async function fillRecipientName(token: string, subscriptionId: string | number, name: string) {
  const response = await apiRequest<{ success: boolean; data: FilledRecipient }>(
    `/admin/billing/subscriptions/${subscriptionId}/recipient-name`,
    { token, method: 'PATCH', body: { recipient_name: name } },
  )
  return response.data
}

export type RecipientNameError = { field: string | null; alreadyFilled: boolean; message: string }

export function recipientNameError(error: unknown): RecipientNameError {
  if (error instanceof ApiRequestError) {
    if (error.status === 409 && error.code === 'recipient_name_present') {
      return { field: null, alreadyFilled: true, message: 'Esta assinatura já tem nome de quem recebe.' }
    }
    if (error.status === 422) {
      return { field: 'recipient_name', alreadyFilled: false, message: 'Use de 2 a 60 caracteres, com pelo menos uma letra e sem @.' }
    }
  }
  return { field: null, alreadyFilled: false, message: error instanceof Error ? error.message : 'Falha ao salvar o nome.' }
}
