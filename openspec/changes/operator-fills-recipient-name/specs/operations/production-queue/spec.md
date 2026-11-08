## ADDED Requirements

### Requirement: A ready row locked by the recipient name can be filled here
A row locked by `recipient_name_missing` MUST offer "Informar quem recebe" to a user with `users.delivery.write`. It MUST open a dialog with one field, "Nome de quem recebe", filled with the item's `account_name` when present, the text "Fica só nesta assinatura. O nome da conta não muda." and "Salvar nome". Saving MUST send the name to the subscription's recipient-name route and reload the list; a 422 MUST show under the field.

#### Scenario: Fill the suggested name

- **WHEN** a ready Brazil row has `courierIssues: ["recipient_name_missing"]` and `account_name: "Ana Costa"`, and an operator with `users.delivery.write` clicks "Informar quem recebe" and "Salvar nome"
- **THEN** the panel sends "Ana Costa" for that subscription, reloads the queue, and the row offers "Expedir"

#### Scenario: Without the permission

- **WHEN** the operator lacks `users.delivery.write`
- **THEN** the row shows the lock and "Ver na entrega" only

## MODIFIED Requirements

### Requirement: Queue search matches the name the queue shows

The queue search (`q`) MUST also match, case-insensitively and as a substring, the subscription address keys the queue reads the customer name from: `recipient_name`, `name`, `full_name` and `recipient`, and the account name the queue shows when the address has none. It MUST keep matching email, Stripe ids and user id. The search field placeholder MUST read "Nome ou e-mail".

#### Scenario: Search by recipient

- **WHEN** a subscription address has `recipient_name: "Ana Souza"` and the operator searches "souza"
- **THEN** the queue lists that cycle

#### Scenario: Search by a legacy name key

- **WHEN** an older subscription address has only `full_name: "Bruno Lima"` and the operator searches "bruno"
- **THEN** the queue lists that cycle

#### Scenario: Search by account name

- **WHEN** a subscription address has no recipient, the account name is "Carla Dias" and the operator searches "dias"
- **THEN** the queue lists that cycle, showing "Carla Dias"
