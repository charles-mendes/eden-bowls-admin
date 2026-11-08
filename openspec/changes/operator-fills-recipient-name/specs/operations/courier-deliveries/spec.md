## MODIFIED Requirements

### Requirement: A row with an address problem cannot be dispatched

A row under "A despachar" or "Falhas" whose `issues` is not empty MUST list what is missing in plain words and MUST NOT offer "Despachar". The panel MUST NOT offer any way to dispatch it anyway or to edit the address, except the recipient name.
A row locked by `recipient_name_missing` MUST offer "Informar quem recebe" to a user with `users.delivery.write`. It MUST open a dialog with one field, "Nome de quem recebe", filled with the item's `account_name` when present, the text "Fica só nesta assinatura. O nome da conta não muda." and "Salvar nome". Saving MUST send the name to the subscription's recipient-name route and reload the list; a 422 MUST show under the field.

#### Scenario: Missing number

- **WHEN** a to-dispatch row has `issues: ["address_number_missing"]`
- **THEN** the row says "Falta o número" and has no "Despachar" button

#### Scenario: Missing recipient filled

- **WHEN** a to-dispatch row has only `issues: ["recipient_name_missing"]` and an operator with `users.delivery.write` saves "João Lima" in "Informar quem recebe"
- **THEN** the tab reloads and the row offers "Despachar"

#### Scenario: Recipient and number missing

- **WHEN** a row has `issues: ["recipient_name_missing", "address_number_missing"]` and the operator saves the name
- **THEN** the row still says "Falta o número" and has no "Despachar"
