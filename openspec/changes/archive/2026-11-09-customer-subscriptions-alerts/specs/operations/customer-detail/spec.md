## ADDED Requirements

### Requirement: Subscription cards show operational alerts

Each subscription card MUST show one badge per item of `alerts`, in the order the API sends, in the card header. The text, the status color and the link MUST be:

| Code | Text | Color | Link |
|---|---|---|---|
| `nfe_problem` | follows the note status: "NF-e rejeitada", "NF-e com erro" or "NF-e sem CPF" | error | the note |
| `nfe_missing` | "NF-e atrasada" | warning | the NF-e list |
| `delivery_failed` | "Entrega falhou" | warning | the failed tab of Entregas Brasil |
| `ready_not_dispatched` | "Pronto sem despacho" | warning | the delivery section of the subscription detail for its market |
| `pending_change` | "Alteração pendente" | info | the subscription detail |

Each badge MUST carry a title with its detail. An unknown code MUST show as a neutral badge with the code. With `alerts: []` or no `alerts` key, the header MUST show no alert badge.

#### Scenario: Rejected note

- **WHEN** a subscription carries `{ code: "nfe_problem", nfeId: 32, status: "rejected", lastError: "CPF inválido" }`
- **THEN** the header shows "NF-e rejeitada" linking to `/operations/nfe/32` with "CPF inválido" in its title

#### Scenario: Ready but not dispatched in Brazil

- **WHEN** a Brazil subscription carries `ready_not_dispatched`
- **THEN** the header shows "Pronto sem despacho" linking to its subscription detail at `#entrega-brasil`

#### Scenario: No alerts

- **WHEN** a subscription carries `alerts: []`
- **THEN** its header shows no alert badge

#### Scenario: Unknown code

- **WHEN** a subscription carries `{ code: "something_new" }`
- **THEN** the header shows a neutral badge "something_new"

### Requirement: Subscriptions tab counts subscriptions with alerts

When at least one subscription has an alert, the "Assinaturas" tab MUST show the number of subscriptions with alerts next to its count, as warning text. With no alerts, it MUST show only the count it shows today.

#### Scenario: One of two subscriptions with alerts

- **WHEN** the customer has two subscriptions and one carries an alert
- **THEN** the tab shows its count and "1 com alerta"
