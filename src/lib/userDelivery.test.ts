import { describe, expect, it } from 'vitest'
import { deliveryBody, type DeliveryForm } from './userDelivery'

const form: DeliveryForm = {
  recipientName: '',
  address: 'Rua Augusta 100',
  number: '100',
  neighborhood: 'Consolação',
  complement: '',
  city: 'São Paulo',
  state: 'SP',
  zipCode: '01310-100',
  deliveryInstructions: '',
}

describe('deliveryBody', () => {
  it('leaves the recipient out when there never was one', () => {
    expect(deliveryBody(form, true, '')).not.toHaveProperty('recipientName')
  })

  it('sends a typed recipient, trimmed', () => {
    expect(deliveryBody({ ...form, recipientName: ' João Lima ' }, true, '')).toMatchObject({ recipientName: 'João Lima' })
  })

  it('sends an emptied stored recipient so the API refuses it', () => {
    expect(deliveryBody(form, true, 'João Lima')).toMatchObject({ recipientName: '' })
  })

  it('drops the Brazil-only fields for a US address', () => {
    const body = deliveryBody(form, false, '')
    expect(body).not.toHaveProperty('number')
    expect(body).not.toHaveProperty('neighborhood')
  })
})
