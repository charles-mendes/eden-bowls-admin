// Shared by the customer tab (PurchaseTrail) and Erros de compra (purchase-error-monitor).
export type TrailError = {
  http_status: number | null
  error_code: string | null
  error_message: string | null
  stripe_code: string | null
  stripe_type: string | null
  stripe_param: string | null
}

export type TrailEvent = TrailError & {
  id: number
  area: string
  step: string
  action: string | null
  outcome: 'ok' | 'failed'
  pet_id: number | null
  subscription_id: string | null
  stripe_event_id: string | null
  stripe_event_type: string | null
  created_at: string | null
}

export type TrailAttempt = TrailError & {
  id: number
  market: 'br' | 'us'
  area: string
  status: 'in_progress' | 'paid' | 'completed' | 'failed'
  final_step: string | null
  attempt_id: string | null
  term_months: number | null
  currency: string | null
  promotion_code_id: string | null
  subscription_id: string | null
  stripe_account: string | null
  started_at: string | null
  finished_at: string | null
  events: TrailEvent[]
}

export type CustomerTrail = { market: 'br' | 'us'; attempts: TrailAttempt[]; unlinked_events: TrailEvent[] }

export type TrailConfigEvent = {
  id: number
  action: string
  target_ref: string | null
  outcome: 'ok' | 'failed'
  error_code: string | null
  actor_admin_id: number | null
  created_at: string | null
}

export const TRAIL_STATUS: Record<TrailAttempt['status'], { label: string; className: string }> = {
  in_progress: { label: 'Em andamento', className: 'badge-info' },
  paid: { label: 'Pago', className: 'badge-success' },
  completed: { label: 'Concluída', className: 'badge-success' },
  failed: { label: 'Falhou', className: 'badge-error' },
}

export const TRAIL_AREAS: Record<string, string> = {
  onboarding: 'Onboarding',
  plan: 'Plano',
  checkout: 'Checkout',
  subscription: 'Assinatura',
  webhook: 'Webhook Stripe',
}

export function trailErrorText(item: TrailError) {
  const parts = [item.error_code, item.stripe_code && item.stripe_code !== item.error_code ? `Stripe: ${item.stripe_code}` : null, item.stripe_param ? `campo ${item.stripe_param}` : null]
  return parts.filter(Boolean).join(' · ')
}

