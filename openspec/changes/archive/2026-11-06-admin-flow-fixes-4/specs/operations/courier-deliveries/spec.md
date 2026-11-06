## ADDED Requirements

### Requirement: A row says whether its NF-e lets the box leave

Entregas Brasil MUST show, on each row of "A despachar" and "Falhas", the invoice's NF-e from the queue: "NF-e {number}" when `authorized` ("NF-e autorizada" without a number). When the queue reports `nfe_required` and the note is not `authorized`, the row MUST show "Aguardando NF-e: {reason}" and its dispatch button MUST be unavailable. When `nfe_required` is false, the row MUST show "NF-e: {reason}" and the button MUST work as before.

#### Scenario: Authorized note

- **WHEN** a row has `nfe` `{ status: "authorized", number: "123" }` and `nfe_required` is true
- **THEN** it shows "NF-e 123" and "Despachar" works

#### Scenario: Authorized without a number

- **WHEN** a row has `nfe` `{ status: "authorized", number: null }`
- **THEN** it shows "NF-e autorizada"

#### Scenario: Note in flight

- **WHEN** `nfe_required` is true and the row's note is `submitted`
- **THEN** it shows "Aguardando NF-e: em emissão" and "Despachar" is unavailable

#### Scenario: No note

- **WHEN** `nfe_required` is true and the row has `nfe` null
- **THEN** it shows "Aguardando NF-e: sem nota registrada" and "Despachar" is unavailable

#### Scenario: Failure tab

- **WHEN** `nfe_required` is true and a "Falhas" row's note is `canceled`
- **THEN** it shows "Aguardando NF-e: cancelada" and "Despachar de novo" is unavailable

#### Scenario: Lock off

- **WHEN** `nfe_required` is false and the row's note is `rejected`
- **THEN** the row shows "NF-e: rejeitada" and "Despachar" works

### Requirement: A blocked note opens where it is fixed

When the row's note is `rejected`, `error` or `blocked_missing_document`, the row MUST link to that note's detail (`/operations/nfe/{id}`), where it is retried or corrected, whether `nfe_required` is on or off. A `canceled` note MUST NOT get the link, since it cannot be retried.

#### Scenario: Rejected note

- **WHEN** a row's note with id 9 is `rejected`
- **THEN** the row links to `/operations/nfe/9`

#### Scenario: Missing CPF

- **WHEN** `nfe_required` is true and a row's note with id 4 is `blocked_missing_document`
- **THEN** it shows "Aguardando NF-e: falta CPF ou nome fiscal" with a link to `/operations/nfe/4`

#### Scenario: Canceled note

- **WHEN** a row's note is `canceled`
- **THEN** the row has no link to the note

### Requirement: A dispatch refused for the NF-e says why

When a dispatch, from Entregas Brasil or from the subscription detail, is refused with `courier_nfe_not_authorized`, the dialog MUST say that the box only leaves with an authorized NF-e, name the note's situation from `nfe_status` (or "sem nota registrada" when null), and say that nothing was dispatched.

#### Scenario: Note changed after the queue loaded

- **WHEN** the API refuses a dispatch with `courier_nfe_not_authorized` and `nfe_status` `rejected`
- **THEN** the dialog shows "A caixa só sai com NF-e autorizada. Situação da nota: rejeitada. Nada foi despachado."
