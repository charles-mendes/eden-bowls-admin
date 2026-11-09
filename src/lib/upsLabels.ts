// Why a UPS label cannot be bought, in the words the operator reads in the panel.
export type LabelIssue = { code: string }

// The 422 codes a purchase can be refused with that read as a label issue, so a refusal reads like the warning.
export const LABEL_ISSUE_CODES = new Set([
  'shipment_market_exception',
  'country_not_supported',
  'po_box_not_allowed',
  'military_address_not_supported',
  'address_incomplete',
  'ship_from_missing',
  'recipient_name_missing',
  'ups_not_configured',
])

// The text of a refused purchase: the label issue text when the code is one, else the API message.
export function labelRefusalText(code: string, fallback: string): string {
  return LABEL_ISSUE_CODES.has(code) ? labelIssueText({ code }) : fallback
}

export function labelIssueText(issue: LabelIssue): string {
  switch (issue.code) {
    case 'shipment_market_exception':
      return 'Conta e país do endereço não combinam: esta assinatura não sai por nenhum mercado. Veja Exceções de mercado.'
    case 'po_box_not_allowed':
      return 'O endereço de entrega é um PO Box, onde a UPS não entrega. O cliente corrige o endereço em Meu Plano, na loja. Se ele não corrigir, fale com ele pelo WhatsApp.'
    case 'military_address_not_supported':
      return 'O endereço é militar (APO, FPO ou DPO), onde a UPS não entrega. O cliente corrige o endereço em Meu Plano, na loja. Se ele não corrigir, fale com ele pelo WhatsApp.'
    case 'address_incomplete':
      return 'Falta rua, cidade, estado ou ZIP no endereço de entrega. O cliente completa o endereço em Meu Plano, na loja. Se ele não corrigir, fale com ele pelo WhatsApp.'
    case 'ship_from_missing':
      return 'O endereço de origem dos EUA não está preenchido.'
    case 'recipient_name_missing':
      return 'Falta o nome de quem recebe na assinatura. O cliente informa quem recebe em Meu Plano, na loja (numa assinatura antiga, pode ajustar o nome em Meu Perfil). Se ele não corrigir, fale com ele pelo WhatsApp.'
    case 'ups_not_configured':
      return 'As credenciais da UPS não estão configuradas na API.'
    default:
      return `Etiqueta bloqueada: ${issue.code}.`
  }
}

// ups-pickup: the pickup a created label belongs to, as the label queue returns it.
export type QueuePickup = { id: number; pickup_date: string; status: 'pending' | 'requested' | 'unknown'; prn: string | null }

export type UpsPickupStatus = 'pending' | 'requested' | 'unknown' | 'canceled' | 'not_created'

export type UpsPickup = {
  id: number
  pickup_date: string
  ready_time: string
  close_time: string
  package_count: number
  status: UpsPickupStatus
  prn: string | null
  shipment_ids: number[]
  requested_by: string | null
}

export const PICKUP_STATUS_LABELS: Record<UpsPickupStatus, string> = {
  pending: 'Pedindo à UPS',
  requested: 'Pedida',
  unknown: 'Sem confirmação da UPS',
  canceled: 'Cancelada',
  not_created: 'Não foi criada',
}

// "2026-11-09" → "09/11", read as a calendar day, without a time zone.
export function pickupDay(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''))
  return match ? `${match[3]}/${match[2]}` : '—'
}

// The pickup line of a created label.
export function pickupLabel(pickup: QueuePickup | null | undefined): string {
  if (!pickup) return 'Sem coleta'
  if (pickup.status === 'unknown') return 'Coleta sem confirmação da UPS'
  if (pickup.status === 'pending') return 'Coleta sendo pedida à UPS'
  return `Coleta pedida para ${pickupDay(pickup.pickup_date)}${pickup.prn ? ` · PRN ${pickup.prn}` : ''}`
}

// The text of a refused pickup request, cancel or close; the API message for a code not listed.
// `missing` comes with pickup_ship_from_incomplete: the ship-from fields UPS needs.
export function pickupErrorText(code: string, fallback: string, missing: string[] = []): string {
  if (code === 'pickup_ship_from_incomplete' && missing.length === 1 && missing[0] === 'phone') {
    return 'O telefone da sede dos EUA está faltando ou curto. A UPS precisa de 10 dígitos (código de área e número) para buscar as caixas.'
  }
  switch (code) {
    case 'pickup_date_not_allowed':
      return 'Não há coleta da UPS nesse dia. Escolha hoje ou o próximo dia útil sem fechamento no calendário.'
    case 'pickup_window_invalid':
      return 'Janela inválida: use HH:MM e um horário de fechamento depois do início.'
    case 'pickup_count_invalid':
      return 'A quantidade de caixas precisa ser um número inteiro a partir de 1.'
    case 'pickup_shipments_required':
      return 'Marque as etiquetas que entram na coleta.'
    case 'pickup_shipment_not_eligible':
      return 'Alguma etiqueta já está em outra coleta ou não está mais criada. A lista foi atualizada; confira e peça de novo.'
    case 'pickup_ship_from_incomplete':
      return 'A UPS precisa do endereço e do telefone da sede dos EUA para buscar as caixas.'
    case 'pickup_unconfirmed':
      return 'A UPS não confirmou a coleta. Confira no portal da UPS antes de pedir de novo.'
    case 'pickup_not_cancelable':
      return 'Só uma coleta pedida pode ser cancelada.'
    case 'pickup_not_unknown':
      return 'Só uma coleta sem confirmação da UPS pode ser fechada como não criada.'
    case 'ups_simulation_only':
      return 'A UPS deste ambiente só simula: não pede nem cancela coleta.'
    case 'ups_not_configured':
      return 'As credenciais da UPS não estão configuradas na API.'
    default:
      return fallback
  }
}

// The status of a UPS label, shown on the subscription detail and on the customer's subscriptions.
export const UPS_SHIPMENT_STATUS: Record<string, { label: string; badge: string }> = {
  created: { label: 'Etiqueta criada', badge: 'badge-success' },
  pending: { label: 'Gerando', badge: 'badge-info' },
  unknown: { label: 'Verificar na UPS', badge: 'badge-warning' },
  voided: { label: 'Anulada', badge: 'badge-error' },
  delivered: { label: 'Entregue', badge: 'badge-success' },
}
