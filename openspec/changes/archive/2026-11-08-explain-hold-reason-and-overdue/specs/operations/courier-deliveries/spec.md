## ADDED Requirements

### Requirement: The dispatch confirmation is titled by its reason

When the API answers a dispatch with `409 courier_dispatch_needs_confirmation`, the dialog title MUST come from the reasons. With exactly one known reason, the title MUST be:
- "Pedido ainda não está pronto" for `production_not_ready`;
- for `subscription_not_active`: "Assinatura cancelada" (`canceled`), "Assinatura pausada" (`paused`), "Assinatura com pagamento pendente" (`past_due`), and "Assinatura não está ativa" for any other status.

With two or more reasons, with no reasons, or with a code the panel does not know, the title MUST be "Confirme antes de despachar". The list of reasons and the "Voltar" and "Despachar mesmo assim" buttons MUST stay as they are.

#### Scenario: Canceled subscription

- **WHEN** the API answers 409 with only `subscription_not_active` and status `canceled`
- **THEN** the dialog is titled "Assinatura cancelada", lists "Assinatura: Cancelada", and offers "Despachar mesmo assim"

#### Scenario: Order still in the kitchen

- **WHEN** the API answers 409 with only `production_not_ready`
- **THEN** the dialog is titled "Pedido ainda não está pronto"

#### Scenario: Two reasons

- **WHEN** the API answers 409 with `production_not_ready` and `subscription_not_active`
- **THEN** the dialog is titled "Confirme antes de despachar" and lists both reasons
