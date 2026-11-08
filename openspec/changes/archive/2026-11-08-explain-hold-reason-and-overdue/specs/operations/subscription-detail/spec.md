## MODIFIED Requirements

### Requirement: Buying a label here asks when the order is not ready

Buying a label from the subscription detail MUST, on `409 ups_label_needs_confirmation`, show the reasons and ask to confirm, and buy only after confirmation, sending `confirm_not_ready`. The question MUST open with a title taken from the reasons, by the same rule as the dispatch confirmation in Entregas Brasil: with exactly one known reason, the title is that reason ("Pedido ainda não está pronto", "Assinatura cancelada" and the other subscription titles). With two or more reasons, with no reasons, or with an unknown code, the title MUST be "Confirme antes de comprar a etiqueta". The question MUST then list the reasons and end with "Comprar mesmo assim?".

#### Scenario: Order in production

- **WHEN** the API answers 409 with `production_not_ready`
- **THEN** the question opens with "Pedido ainda não está pronto", lists "Preparo: Em preparo", ends with "Comprar mesmo assim?", and the detail buys only if confirmed

#### Scenario: Canceled subscription

- **WHEN** the API answers 409 with only `subscription_not_active` and status `canceled`
- **THEN** the question opens with "Assinatura cancelada", not with "Pedido ainda não está pronto"

#### Scenario: Two reasons

- **WHEN** the API answers 409 with `production_not_ready` and `subscription_not_active`
- **THEN** the question opens with "Confirme antes de comprar a etiqueta", lists both reasons, and ends with "Comprar mesmo assim?"
