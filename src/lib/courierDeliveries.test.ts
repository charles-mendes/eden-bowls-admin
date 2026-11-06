import { describe, expect, it } from 'vitest'
import { ApiRequestError } from './api'
import { courierErrorText, courierNfeState } from './courierDeliveries'
import type { NfeStatus } from './nfe'

// admin-flow-fixes-4 (PM-25): what a row says about its NF-e, and the refused dispatch.
describe('courierNfeState', () => {
  const nfe = (status: NfeStatus, id = 9, number: string | null = null) => ({ id, status, number })

  it('lets an authorized note through, with or without its number', () => {
    expect(courierNfeState(nfe('authorized', 3, '123'), true)).toEqual({ text: 'NF-e 123', blocks: false, href: null })
    expect(courierNfeState(nfe('authorized'), true)).toEqual({ text: 'NF-e autorizada', blocks: false, href: null })
  })

  it.each([
    ['pending', 'em emissão', null],
    ['submitted', 'em emissão', null],
    ['blocked_missing_document', 'falta CPF ou nome fiscal', '/operations/nfe/9'],
    ['rejected', 'rejeitada', '/operations/nfe/9'],
    ['error', 'com erro', '/operations/nfe/9'],
    ['canceled', 'cancelada', null],
  ] as const)('%s holds the box with the lock on and only informs with it off', (status, reason, href) => {
    expect(courierNfeState(nfe(status), true)).toEqual({ text: `Aguardando NF-e: ${reason}`, blocks: true, href })
    expect(courierNfeState(nfe(status), false)).toEqual({ text: `NF-e: ${reason}`, blocks: false, href })
  })

  it('names a cycle with no note recorded', () => {
    expect(courierNfeState(null, true)).toEqual({ text: 'Aguardando NF-e: sem nota registrada', blocks: true, href: null })
    expect(courierNfeState(null, false)).toEqual({ text: 'NF-e: sem nota registrada', blocks: false, href: null })
  })
})

describe('courierErrorText for the fiscal lock', () => {
  it('names the note and says nothing was dispatched', () => {
    const refused = (nfeStatus: string | null) => new ApiRequestError('locked', 422, 'courier_nfe_not_authorized', { code: 'courier_nfe_not_authorized', nfe_status: nfeStatus, nfe_id: 9 })
    expect(courierErrorText(refused('rejected'))).toBe('A caixa só sai com NF-e autorizada. Situação da nota: rejeitada. Nada foi despachado.')
    expect(courierErrorText(refused(null))).toBe('A caixa só sai com NF-e autorizada. Situação da nota: sem nota registrada. Nada foi despachado.')
  })
})
