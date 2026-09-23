# operations/admin-panel-copy Specification

## Purpose

Puts operator-facing admin copy in Portuguese while leaving API codes, search tokens, privacy terms, and the US nutrition simulator in their current language.

## Requirements

### Requirement: Assinantes copy is Portuguese

The Assinantes page at `/billing` MUST describe the local Stripe record in Portuguese and MUST say that pause and cancel are not done on this screen. The catalog section MUST describe catalog health and price sync in Portuguese. The sync button MUST read **Sincronizar catálogo**. The mapped-count line MUST read **Mapeados** with the mapped and expected counts, and MUST show the sync job in Portuguese (`na fila`, `concluído`, or `nenhum job` when there is no job). The subscription filter MUST start on active subscriptions and MUST say that clearing filters returns to active. Filter options and the status column MUST show Portuguese labels for `active`, `trialing`, `past_due`, `canceled`, `canceling`, and `all`. The option values sent to the API MUST stay the English codes. Table headers MUST use **Assinatura**, **Renovação automática**, and **Próxima cobrança**. The billing menu group MUST read **Cobrança**.

#### Scenario: Operator opens Assinantes

- **WHEN** an operator opens `/billing` after a completed catalog sync that mapped 9 of 9 prices
- **THEN** the page does not show “Ledger local Stripe”, “Health e sync”, “Sync catálogo”, “Mapped”, or “completed”, and the status line shows **Mapeados 9/9 · concluído**

#### Scenario: Status filter keeps the API code

- **WHEN** the operator filters subscriptions by the Portuguese label for past due
- **THEN** the request still sends `status=past_due`

### Requirement: Subscription detail actions are Portuguese

The subscription detail page MUST describe the ledger in Portuguese and MUST say that pause and cancel stay on the customer API. The invoice sync button MUST read **Sincronizar faturas**. The UPS section title MUST be **Envio UPS**, with columns **Fatura**, **Rastreio**, **Cotado**, and **Custo UPS**, and actions **Baixar**, **Atualizar rastreio**, and **Anular**. Fixed frontend fallbacks for those actions MUST be Portuguese. A message returned by the API MUST be shown as received.

#### Scenario: Operator sees UPS actions

- **WHEN** an operator with shipping write opens a subscription that has a UPS label
- **THEN** the actions read **Baixar**, **Atualizar rastreio**, and **Anular**, not Download, Refresh tracking, or Void

### Requirement: Remaining operator copy is Portuguese

Onboarding, checkout snapshots, the customer delivery-instructions section, production filter help, the shared nutrition description, dashboard sync link, shipping form labels, product publish messages, and business-rule labels that are fixed in the panel MUST be Portuguese. The product detail sync button MUST stay **Sincronizar Stripe**. The dashboard title MUST stay **Dashboard**. The technical recurrence JSON disclosure MUST be in Portuguese and MUST NOT be titled **Recorrência**.

#### Scenario: Technical recurrence is not the plan choice

- **WHEN** an operator opens a checkout or subscription that shows the stored recurrence JSON
- **THEN** the disclosure title is not **Recorrência** and is not “Payload recurrence”

#### Scenario: US nutrition simulator stays English

- **WHEN** a nutritionist session is on the US market and opens the nutrition simulator
- **THEN** the page title is **Nutrition simulator**

### Requirement: Some English stays on purpose

The panel MUST keep showing DSAR, opt-in, opt-out, and **Opt-out de share**. It MUST keep role values `admin`, `operator`, `nutritionist`, and `readonly`. It MUST keep Stripe id prefixes (`promo_`, `sub_`, `cus_`, and any `price_`, `pm_`, `seti_`, or `pi_` prefix) as typed search or id text. The create-coupon name placeholder MUST stay English and MUST NOT be submitted unless the operator enters a name.

#### Scenario: Privacy terms are unchanged

- **WHEN** an operator opens the privacy queue or a customer privacy section
- **THEN** the type **Opt-out de share** and the words opt-in, opt-out, and DSAR are still present where they are today

#### Scenario: API error stays in the API language

- **WHEN** a save fails and the API returns an English message
- **THEN** the panel shows that message and does not replace it with a Portuguese translation
