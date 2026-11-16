## Purpose

Defines how Etiquetas UPS buys labels from the panel and handles an order the API says is not ready.

## ADDED Requirements

### Requirement: The batch sends the confirmation the operator gave

When the selection holds orders not ready or with a subscription not active, the queue MUST ask once, listing them, and send `confirm_not_ready: true` only for those the operator confirmed. When the API still answers `409 ups_label_needs_confirmation` for an order, that order MUST end as "Precisa confirmar" with the reasons, nothing bought, and the batch MUST go on. The "Verificar na UPS" section MUST be reachable by the anchor `verificar-ups`.

#### Scenario: Confirmed order not ready

- **WHEN** the operator confirms buying an order in production
- **THEN** its purchase carries `confirm_not_ready: true` and the label is bought

#### Scenario: Opened from Today

- **WHEN** the page opens at `/operations/labels#verificar-ups`
- **THEN** it scrolls to the "Verificar na UPS" section once the queue loads

#### Scenario: Status changed meanwhile

- **WHEN** an order was ready when the queue loaded and the API answers 409 for it
- **THEN** it ends as "Precisa confirmar", no label is bought for it, and the other orders are bought
