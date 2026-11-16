import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MarketExceptionsPage } from './MarketExceptionsPage'
import { marketExceptionItem, operatorWriteUser } from '../test/fixtures'
import { installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

const render = () => renderAuthedPage(<MarketExceptionsPage />, '/operations/market-exceptions', '/operations/market-exceptions')

describe('MarketExceptionsPage', () => {
  beforeEach(() => {
    seedAuth()
  })
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('lists a crossed subscription with its account, country, customer and link', async () => {
    installAdminFetchMock(operatorWriteUser, { marketExceptions: [marketExceptionItem] })
    render()

    expect(await screen.findByText('Ana Costa')).toBeInTheDocument()
    expect(screen.getByText('ana@example.com')).toBeInTheDocument()
    expect(screen.getByText('Conta BR')).toBeInTheDocument()
    expect(screen.getByText('Endereço US')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Assinatura' })).toHaveAttribute('href', '/billing/subscriptions/42')
  })

  it('names an address without a country', async () => {
    installAdminFetchMock(operatorWriteUser, { marketExceptions: [{ ...marketExceptionItem, address_country: '' }] })
    render()
    expect(await screen.findByText('Endereço sem país')).toBeInTheDocument()
  })

  it('says there are no exceptions', async () => {
    installAdminFetchMock(operatorWriteUser, { marketExceptions: [] })
    render()
    expect(await screen.findByText('Nenhuma exceção de mercado.')).toBeInTheDocument()
  })
})
