## ADDED Requirements

### Requirement: A name taken from the account is marked

When a row has `name_source: "account"`, the row MUST show the name followed by "(conta)" in muted text. With `recipient` or `email` the row MUST show the name as today.

#### Scenario: Account name on a locked row

- **WHEN** a to-dispatch row has `recipient_name: "Ana Costa"`, `name_source: "account"` and `issues: ["recipient_name_missing"]`
- **THEN** the row shows "Ana Costa (conta)" and "Falta o nome de quem recebe"

## MODIFIED Requirements

### Requirement: A row with an address problem cannot be dispatched

A row under "A despachar" or "Falhas" whose `issues` is not empty MUST list what is missing in plain words and MUST NOT offer "Despachar". The panel MUST NOT offer any way to dispatch it anyway or to edit the address, except the recipient name.
A row locked by `recipient_name_missing` MUST offer "Informar quem recebe" to a user with `users.delivery.write`. It MUST open a dialog with one empty field, "Nome de quem recebe", the text "Fica nesta assinatura e vale para os próximos pedidos. O nome da conta não muda. Se for presente, confirme com o cliente." and "Salvar nome". When the item has `account_name`, the dialog MUST offer "Usar nome da conta ({account_name})", which fills the field without saving. A 409 `recipient_name_present` MUST say "Esta assinatura já tem nome de quem recebe." and reload. Saving MUST send the name to the subscription's recipient-name route and reload the list; a 422 MUST show under the field.

#### Scenario: Missing number

- **WHEN** a to-dispatch row has `issues: ["address_number_missing"]`
- **THEN** the row says "Falta o número" and has no "Despachar" button

#### Scenario: Missing recipient filled

- **WHEN** a to-dispatch row has only `issues: ["recipient_name_missing"]` and an operator with `users.delivery.write` saves "João Lima" in "Informar quem recebe"
- **THEN** the tab reloads and the row offers "Despachar"

#### Scenario: Recipient and number missing

- **WHEN** a row has `issues: ["recipient_name_missing", "address_number_missing"]` and the operator saves the name
- **THEN** the row still says "Falta o número" and has no "Despachar"
