import { describe, expect, it } from 'vitest'
import { alertPresentation, type SubscriptionAlert } from './customerSubscriptions'

const br = { id: 'sub-row-1', stripeAccount: 'br' }
const us = { id: 'sub-row-2', stripeAccount: 'us' }

describe('alertPresentation', () => {
  it.each([
    ['rejected', 'NF-e rejeitada'],
    ['error', 'NF-e com erro'],
    ['blocked_missing_document', 'NF-e sem CPF'],
  ])('nfe_problem %s reads "%s", links to the note and titles the error', (status, text) => {
    const alert = { code: 'nfe_problem', nfeId: 32, status, lastError: 'CPF inválido' } as SubscriptionAlert
    expect(alertPresentation(alert, br)).toEqual({ text, badge: 'badge-error', href: '/operations/nfe/32', title: 'CPF inválido' })
  })

  it('nfe_missing links to the NF-e list', () => {
    const result = alertPresentation({ code: 'nfe_missing', status: null, paidAt: '2026-11-07T12:00:00.000Z' }, br)
    expect(result).toMatchObject({ text: 'NF-e atrasada', badge: 'badge-warning', href: '/operations/nfe' })
    expect(result.title).toContain('sem nota emitida')
  })

  it('delivery_failed links to the failed tab of Entregas Brasil', () => {
    expect(alertPresentation({ code: 'delivery_failed', courierDeliveryId: 8, failedAt: null }, br))
      .toMatchObject({ text: 'Entrega falhou', badge: 'badge-warning', href: '/operations/courier?aba=falhas' })
  })

  it('ready_not_dispatched links to the delivery section of its market', () => {
    const alert = { code: 'ready_not_dispatched', deliveryDate: '2026-11-09' } as SubscriptionAlert
    expect(alertPresentation(alert, br)).toMatchObject({ text: 'Pronto sem despacho', href: '/billing/subscriptions/sub-row-1#entrega-brasil' })
    expect(alertPresentation(alert, us).href).toBe('/billing/subscriptions/sub-row-2#envio-ups')
    expect(alertPresentation(alert, br).title).toContain('09/11/2026')
  })

  it('pending_change names its kinds', () => {
    expect(alertPresentation({ code: 'pending_change', kinds: ['edit', 'delivery'] }, br)).toEqual({
      text: 'Alteração pendente',
      badge: 'badge-info',
      href: '/billing/subscriptions/sub-row-1',
      title: 'Pendente: edição esperando pagamento e mudança de entrega.',
    })
  })

  it('an unknown code stays visible as a neutral badge', () => {
    expect(alertPresentation({ code: 'something_new' }, br)).toEqual({ text: 'something_new', badge: 'badge-neutral', href: null, title: 'something_new' })
  })
})
