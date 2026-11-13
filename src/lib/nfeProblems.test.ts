import { describe, expect, it } from 'vitest'
import { blingProblemGuide, splitNfeError } from './nfe'

describe('blingProblemGuide', () => {
  it.each([
    ['contato.telefone', 'Informe o telefone', 'Dados do cliente'],
    ['itens[0].ncm', 'NCM inválido', 'Cadastro do produto no Bling'],
    ['itens[1].cfop', 'CFOP incompatível', 'Natureza de operação no Bling'],
    ['transporte.volumes', 'Informe os volumes', 'Transporte da nota'],
    ['parcelas[0].formaPagamento', 'Forma inválida', 'Pagamento da nota'],
    ['', 'Certificado digital vencido', 'Cadastro da empresa no Bling'],
    ['', 'Há informações obrigatórias faltando na nota', 'Não identificado'],
  ])('%s · %s → %s', (element, message, where) => {
    expect(blingProblemGuide({ element, message }).where).toBe(where)
  })
})

describe('splitNfeError', () => {
  it('takes the first part as the headline', () => {
    expect(splitNfeError('A · B · C')).toEqual({ title: 'A', details: ['B', 'C'] })
    expect(splitNfeError('Só isso')).toEqual({ title: 'Só isso', details: [] })
  })
})
