export type DeliveryForm = {
  recipientName: string
  address: string
  number: string
  neighborhood: string
  complement: string
  city: string
  state: string
  zipCode: string
  deliveryInstructions: string
}

// A US address has no number or neighborhood. An address that never had a recipient and still has none
// leaves the field out, so the API keeps it as it is; anything typed goes and the API validates it.
export function deliveryBody(delivery: DeliveryForm, isBrazil: boolean, storedRecipient: string): Partial<DeliveryForm> {
  const body: Partial<DeliveryForm> = { ...delivery, recipientName: delivery.recipientName.trim() }
  if (!isBrazil) {
    delete body.number
    delete body.neighborhood
  }
  if (!body.recipientName && !storedRecipient.trim()) delete body.recipientName
  return body
}
