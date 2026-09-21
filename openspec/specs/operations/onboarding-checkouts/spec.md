# operations/onboarding-checkouts Specification

## Purpose

Shows operators the store-chosen subscription term (1 / 3 / 6 months) on Onboarding 360 checkouts — list, session detail, and CSV — without labeling the aliased recurrence field as a customer choice.

## Requirements

### Requirement: Checkout list shows the chosen plan term in words

The Onboarding 360 checkout list MUST display a column titled **Prazo (plano escolhido)**. The cell MUST show the term from the checkout plan selection as `1 mês` when the term is 1, `<n> meses` when the term is a finite number greater than 1, and an empty-value placeholder when the term is missing or not a positive number. The list MUST NOT show a Recorrência column and MUST NOT show compact `Nm` term text in that column. The JSON list payload MAY still include `frequency` and numeric `termMonths`; those fields MUST NOT appear as Recorrência / Mensal / Quinzenal / Semanal in the table.

#### Scenario: One-month checkout

- **WHEN** an operator opens `/onboarding/sessions` and a row has plan term 1
- **THEN** the row shows **1 mês** under **Prazo (plano escolhido)** and no Recorrência column header exists

#### Scenario: Three-month checkout

- **WHEN** a row has plan term 3
- **THEN** the prazo cell is **3 meses**

#### Scenario: Missing plan term

- **WHEN** a row has no positive plan term
- **THEN** the prazo cell is the empty-value placeholder and not the text `null meses`

### Requirement: Session detail does not present recurrence as a plan choice

The Onboarding 360 session detail MUST show the plan term in the same spelled-out form as the list. The plan summary MUST NOT include a Recorrência label with Mensal / Quinzenal / Semanal. A technical JSON dump of the stored recurrence object MAY remain if it is titled so it is not read as the customer’s plan choice. The stored recurrence document MUST remain available to the API.

#### Scenario: Plan grid hides Recorrência

- **WHEN** an operator opens a checkout session that has both plan term 1 and recurrence frequency monthly
- **THEN** the plan summary shows **1 mês** and does not show a Recorrência row with **Mensal**

#### Scenario: Technical dump stays

- **WHEN** the session payload includes a recurrence object
- **THEN** the operator can still inspect that JSON under a technical title, not as Recorrência

### Requirement: Checkout CSV keeps existing columns and appends a term label

`GET /api/v1/admin/onboarding/checkouts.csv` MUST keep the previous header columns in this exact order: `userId`, `email`, `displayName`, `updatedAt`, `stripeStatus`, `stripeSubscriptionId`, `frequency`, `termMonths`, `firstInvoiceTotal`. It MUST append `termLabel` after `firstInvoiceTotal`. `frequency` MUST remain the legacy Portuguese aliases (Mensal / Quinzenal / Semanal). `termMonths` MUST remain a number (`1` / `3` / `6`) or empty. `termLabel` MUST use the same wording as the list (`1 mês`, `<n> meses`) and MUST be empty when the term is missing — not the list placeholder. The CSV body MUST NOT start with a UTF-8 BOM in this change.

#### Scenario: Header contract

- **WHEN** an operator exports the checkout CSV
- **THEN** the first line is exactly `userId,email,displayName,updatedAt,stripeStatus,stripeSubscriptionId,frequency,termMonths,firstInvoiceTotal,termLabel`

#### Scenario: One-month row

- **WHEN** a checkout has frequency monthly and term 1
- **THEN** the row’s `frequency` is Mensal, `termMonths` is 1, and `termLabel` is `1 mês`

#### Scenario: Missing term in CSV

- **WHEN** a checkout has no positive plan term
- **THEN** `termMonths` and `termLabel` are empty

#### Scenario: Twelve-month plural

- **WHEN** a checkout has term 12
- **THEN** `termLabel` is `12 meses`
