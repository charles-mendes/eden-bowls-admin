# operations/subscription-detail Specification

## Purpose

Lets operators read a subscription ledger's stored product mix, delivery address, and freight quote without parsing raw JSON, while keeping the original payloads available for support.

## Requirements

### Requirement: Subscription detail shows the stored product mix

The subscription detail page MUST replace the raw Snapshots JSON blocks with a section titled **Detalhes do produto**. That section MUST describe the values as the checkout snapshot, without a live recalculation. Pets and flavors MUST come from the stored plan selection. Each pet row MUST show the plan pet name and the selected flavors. When a flavor has a stored weight, the row MUST show that weight next to the flavor. When the plan selection includes catalog line items, the section MUST also show a table with pet, item, quantity, pack size, unit price, and line total. When the plan selection has no catalog line items, that table MUST NOT appear.

#### Scenario: Flavor mix without line items

- **WHEN** an operator opens a subscription whose plan selection lists pet `luna` with flavors `beef` and `fish` at weights 5 and 5, and no catalog line items
- **THEN** **Detalhes do produto** shows `luna` with `beef` and `fish` each weighted 5, and no item price table

#### Scenario: Catalog line items

- **WHEN** the plan selection includes catalog line items for those flavors
- **THEN** the section also shows quantity, pack size, unit price, and line total for each item

### Requirement: Snapshot-only pets stay visible

A pet present only in `petsSnapshot` MUST still appear in the product table. Its flavor cell MUST be empty. When the same pet id exists in both payloads with different names, the table MUST show the name from the plan selection.

#### Scenario: Pet missing from the plan

- **WHEN** `petsSnapshot` names a pet that the plan selection does not list
- **THEN** that pet appears in the product table with an empty flavor cell

#### Scenario: Names diverge for the same pet

- **WHEN** the same pet id is `Luna` in `petsSnapshot` and `luna` in the plan selection
- **THEN** the product table shows `luna`

### Requirement: Address and freight stay readable

The page MUST show **Endereço** and **Frete** as separate sections, not inside the product section and not as raw JSON. A stored address MUST be shown as formatted lines (street and number, complement, neighborhood, city and state, postal code, country) plus phone and delivery instructions when those fields exist. When no address is stored, the section MUST show **Sem endereço na cópia gravada**. Freight MUST show method, cost, distance, rate, delivery time, quoted postal code, and quote time when those fields exist. A missing freight field MUST be omitted. A missing freight payload MUST NOT invent a cost. Section descriptions MUST say the values are the stored checkout copy and MUST NOT say they are recalculated live.

#### Scenario: Complete address and freight

- **WHEN** the subscription stores a street address and a distance-based freight quote
- **THEN** the operator sees the formatted address and the stored freight method, cost, distance, and delivery time

#### Scenario: Incomplete address and no freight

- **WHEN** the address has no usable lines and freight is absent
- **THEN** the address section shows **Sem endereço na cópia gravada** and the freight section does not show a cost

### Requirement: Technical JSON stays collapsed

The four stored payloads (`petsSnapshot`, `planSelection`, `address`, `shipping`) MUST remain available under **JSON técnico**, each in a collapsed disclosure. The raw JSON MUST NOT be visible until the operator opens that disclosure. The subscription detail page MUST NOT show discount or payment snapshot sections.

#### Scenario: Page load hides raw JSON

- **WHEN** an operator opens the subscription detail
- **THEN** the product, address, and freight sections are visible and the raw JSON text is not

#### Scenario: Operator opens a payload

- **WHEN** the operator expands a technical JSON disclosure
- **THEN** that payload's stored JSON is shown

### Requirement: Stripe PDF names the subscription's account

"PDF Stripe" MUST request the invoice PDF with the subscription's Stripe account as `account`, so a session with both markets opens the PDF instead of getting `404`.

#### Scenario: Admin with both markets

- **WHEN** an admin with BR and US clicks "PDF Stripe" on an invoice of a `br` subscription
- **THEN** the panel requests `/api/v1/admin/billing/invoices/<invoice>/pdf?account=br` and opens the returned URL

### Requirement: Shipping sections list the paid cycles

"Envio UPS" and "Entrega Brasil" MUST list the subscription's paid cycles from the API, each with preparation day, production status, delivery date and shipping state, without needing "Sincronizar faturas". Paid invoices with no cycle (old or zero-value) MUST NOT appear as waiting for a label or a courier. The section shown MUST follow the same rule as today.

#### Scenario: Opened from Today

- **WHEN** an operator opens a subscription with one ready paid cycle and no label
- **THEN** "Envio UPS" lists that cycle as waiting for a label, before any sync

#### Scenario: Zero-value invoice

- **WHEN** the subscription's invoices include a paid zero-value invoice with no cycle
- **THEN** it is not listed as waiting

### Requirement: Buying a label here asks when the order is not ready

Buying a label from the subscription detail MUST, on `409 ups_label_needs_confirmation`, show the reasons and ask to confirm, and buy only after confirmation, sending `confirm_not_ready`.

#### Scenario: Order in production

- **WHEN** the API answers 409 with `production_not_ready`
- **THEN** the detail asks "Este pedido ainda não está pronto. Comprar mesmo assim?" and buys only if confirmed

### Requirement: The detail keeps the contact history

The detail MUST show the subscription's contacts, newest first, and offer "Registrar contato" to a user with `customers.contact.write`, with the account phone and a copy button beside it.

#### Scenario: History

- **WHEN** the subscription has two contacts
- **THEN** both show, newest first, with reason, outcome, note, who and when

### Requirement: The detail shows the address problem

When the subscription detail has `address_issue`, the page MUST show its codes in plain words, the source, the email state, and the "Registrar contato" action for users with `customers.contact.write`. It MUST NOT offer a field to rewrite the address.

#### Scenario: Open problem

- **WHEN** an operator opens a subscription whose problem lists a missing neighborhood and whose email went out
- **THEN** the detail says the neighborhood is missing, shows "E-mail enviado em" with the date, and offers "Registrar contato"

### Requirement: Dispatch here is held by the address

In "Entrega Brasil", when the subscription detail's `courier_issues` is not empty, each "Despachar" MUST be disabled and the section MUST say what is missing, in the same words as Entregas Brasil, before any dialog opens. The detail MUST NOT offer any way to dispatch anyway.
A section locked by `recipient_name_missing` MUST offer "Informar quem recebe" to a user with `users.delivery.write`. It MUST open a dialog with one empty field, "Nome de quem recebe", the text "Fica nesta assinatura e vale para os próximos pedidos. O nome da conta não muda. Se for presente, confirme com o cliente." and "Salvar nome". When the detail has `account_name`, the dialog MUST offer "Usar nome da conta ({account_name})", which fills the field without saving. A 409 `recipient_name_present` MUST say "Esta assinatura já tem nome de quem recebe." and reload. Saving MUST send the name to the subscription's recipient-name route and reload the subscription; a 422 MUST show under the field. When `courier_issues` is empty, null or absent, "Despachar" MUST behave as before.

#### Scenario: No recipient name

- **WHEN** an operator with `shipping.write` opens a Brazil subscription whose `courier_issues` is `["recipient_name_missing"]` and that has a paid cycle waiting
- **THEN** "Despachar" is disabled, the section says "Falta o nome de quem recebe", and no dispatch dialog can open

#### Scenario: Complete address

- **WHEN** `courier_issues` is empty
- **THEN** "Despachar" opens the dispatch dialog as before

#### Scenario: Recipient filled in the detail

- **WHEN** `courier_issues` is `["recipient_name_missing"]` and an operator with `users.delivery.write` saves a name in "Informar quem recebe"
- **THEN** the subscription reloads and "Despachar" is enabled
