# operations/nfe-invoices Specification

## Purpose

Defines how the panel lists and shows Brazilian NF-e notes: filters, the links to the customer and the subscription, how the detail refreshes while a note is in flight, and how the operator corrects the customer data of a note.

## Requirements

### Requirement: NF-e list filters live in the URL

Notas fiscais (`/operations/nfe`) MUST read `status`, `de`, `ate`, `busca` and `pagina` from the URL on load and MUST write them back when they change, so a link opens the list already filtered. Clearing a filter MUST remove its parameter.

#### Scenario: Link with a status

- **WHEN** the operator opens `/operations/nfe?status=rejected`
- **THEN** the status filter shows Rejeitada and the request sends `status=rejected`

#### Scenario: Back to the list keeps the filter

- **WHEN** the operator filters by Erro, opens a note and goes back
- **THEN** the list still shows the Erro filter

### Requirement: Notes that need action

The status filter MUST offer "Precisam de ação", which MUST request the notes whose status is `blocked_missing_document`, `rejected` or `error` in one list, with the URL value `status=needs_action`.

#### Scenario: Filter notes that need action

- **WHEN** the operator picks "Precisam de ação"
- **THEN** the request sends `status=blocked_missing_document,rejected,error` and the list shows only those notes

### Requirement: NF-e detail links to the customer and the subscription

The NF-e detail MUST show "Abrir cliente", linking to `/users/<user_id>`, when the note has a `user_id`. It MUST show "Abrir assinatura", linking to `/billing?busca=<stripe_subscription_id>&status=all`, when the note has a `stripe_subscription_id`. Imported notes without these ids MUST show neither.

#### Scenario: Note from a subscription

- **WHEN** a note has `user_id` 42 and `stripe_subscription_id` `sub_123`
- **THEN** the detail links to `/users/42` and to `/billing?busca=sub_123&status=all`

### Requirement: NF-e detail refreshes while the note is in flight

While the note's status is `pending` or `submitted`, the detail MUST reload every 5 seconds. In any other status it MUST reload every 60 seconds. After "Nova tentativa" succeeds, the faster reload MUST start without a page reload.

#### Scenario: Retry shows the outcome

- **WHEN** the operator clicks "Nova tentativa" and the note goes to `pending`
- **THEN** the detail reloads every 5 seconds until the status leaves `pending` and `submitted`

### Requirement: Correcting a note's customer data asks for a reason

"Corrigir dados" MUST state that it changes only this note, not the customer's subscription or account. Saving MUST require a reason of 3 to 255 characters and MUST send it as `reason` with the correction.

#### Scenario: Save without a reason

- **WHEN** the operator corrects the address and leaves the reason empty
- **THEN** the dialog does not submit and the reason field is marked required

#### Scenario: Save with a reason

- **WHEN** the operator corrects the CPF with reason "CPF digitado errado no checkout"
- **THEN** `PATCH /api/v1/admin/nfe/<id>/customer` carries `reason: "CPF digitado errado no checkout"`

### Requirement: A blocked note says what is missing and where it is fixed

A note with `missing_fields` MUST list "CPF" and "Nome fiscal" as missing, MUST say the customer fixes them in Meu plano → Editar assinatura, and MUST show the subscription's `address_issue` email state. "Corrigir dados" MUST stay available as an exception.

#### Scenario: Missing fiscal name

- **WHEN** an operator opens a note with `missing_fields: ["fiscal_name"]` and an open problem whose email went out
- **THEN** the detail says the fiscal name is missing, that the customer fixes it in the store, and shows "E-mail enviado em" with the date
