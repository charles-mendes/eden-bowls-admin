import { describe, expect, it } from 'vitest'
import { addressIssueState, issueCodeText, issueSourceText, type AddressIssue } from './addressIssues'

const NOW = new Date('2026-11-07T15:00:00Z')
const issue = (overrides: Partial<AddressIssue> = {}): AddressIssue => ({
  id: 3,
  codes: ['address_number_missing'],
  source: 'courier_check',
  open: true,
  opened_at: '2026-11-03T12:00:00Z',
  email_sent_at: '2026-11-03T12:00:05Z',
  resolved_at: null,
  resolved_by: null,
  ...overrides,
})

describe('issueCodeText', () => {
  it.each([
    ['address_street_missing', 'Falta a rua'],
    ['address_number_missing', 'Falta o número'],
    ['address_neighborhood_missing', 'Falta o bairro'],
    ['address_city_missing', 'Falta a cidade'],
    ['address_state_missing', 'Falta o estado'],
    ['address_zipcode_invalid', 'CEP inválido (precisa de 8 dígitos)'],
    ['recipient_name_missing', 'Falta o nome de quem recebe'],
    ['address_incomplete', 'Endereço incompleto (rua, cidade, estado ou ZIP)'],
    ['po_box_not_allowed', 'Endereço é PO Box'],
    ['military_address_not_supported', 'Endereço militar (APO, FPO ou DPO)'],
    ['courier_address_unusable', 'O entregador não conseguiu usar o endereço'],
    ['tax_document_missing', 'Falta o CPF'],
    ['fiscal_name_missing', 'Falta o nome fiscal'],
  ])('%s', (code, text) => {
    expect(issueCodeText(code)).toBe(text)
  })

  it('shows an unknown code as is, and names the source', () => {
    expect(issueCodeText('something_new')).toBe('something_new')
    expect(issueSourceText('nfe_check')).toBe('NF-e travada')
  })
})

describe('addressIssueState', () => {
  it('open with the email sent, for 4 days', () => {
    expect(addressIssueState(issue(), NOW)).toEqual({ email: 'E-mail enviado em 03/11', waiting: 'Sem correção há 4 dias', tone: 'warning' })
  })

  it('open without an email, opened yesterday: no waiting line yet', () => {
    expect(addressIssueState(issue({ email_sent_at: null, opened_at: '2026-11-06T12:00:00Z' }), NOW))
      .toEqual({ email: 'E-mail não enviado', waiting: null, tone: 'error' })
  })

  it('fixed by the customer', () => {
    expect(addressIssueState(issue({ open: false, resolved_by: 'customer', resolved_at: '2026-11-05T13:00:00Z' }), NOW))
      .toEqual({ email: 'Cliente corrigiu em 05/11', waiting: null, tone: 'success' })
  })

  it('waits only after more than 2 days', () => {
    expect(addressIssueState(issue({ opened_at: '2026-11-05T12:00:00Z' }), NOW).waiting).toBeNull()
    expect(addressIssueState(issue({ opened_at: '2026-11-04T12:00:00Z' }), NOW).waiting).toBe('Sem correção há 3 dias')
  })
})
