# Spec Delta

## Purpose

Shows operations and the client real revenue, subscription, acquisition, mix, operations and stock reports from `/api/v1/admin/reports/*`, one market at a time or side by side, without mixing currencies and under the panel's role, permission and market rules.

## ADDED Requirements

### Requirement: Reports menu item follows role and permission

The sidebar MUST list **Relatórios** in Visão geral, right after **Hoje** (and after **Visão do negócio** when the demo build shows it), only for sessions with role `admin`, `operator` or `readonly` and with permission `reports.read`. The item MUST NOT depend on `VITE_DEMO_INSIGHTS`.

#### Scenario: Operator sees Relatórios after Hoje

- **WHEN** an operator with `reports.read` opens the sidebar with the demo flag unset
- **THEN** Visão geral lists **Hoje** then **Relatórios**

#### Scenario: Session without the permission

- **WHEN** a readonly session whose `/admin/me` lacks `reports.read` opens the sidebar
- **THEN** **Relatórios** is absent

### Requirement: Veterinarian-only sessions never see reports

A veterinarian-only session MUST NOT see the menu item. Opening `/reports` MUST redirect to `/nutrition/simulate` without calling any report route.

#### Scenario: Direct URL stays on the simulator

- **WHEN** a veterinarian-only session opens `/reports?aba=receita`
- **THEN** the panel shows the nutrition simulator and no `/admin/reports/*` request is sent

### Requirement: Reports read the API

Every number on `/reports` MUST come from `/api/v1/admin/reports/*`. The page MUST NOT use the demonstration fixture and MUST NOT show **Dados de demonstração**. While a report loads, its cards MUST show a loading state. Each request MUST send `market`, `from`, `to` and, when the user changed it, `granularity`.

#### Scenario: Revenue tab calls the revenue route

- **WHEN** an admin opens `/reports?aba=receita&mercado=US`
- **THEN** the panel calls `GET /admin/reports/revenue` with `market=US` and the default 30-day `from`/`to`

### Requirement: Tabs and URL state

The page MUST offer the tabs Resumo, Receita, Assinaturas, Aquisição, Mix, Operação and Estoque, with Resumo as the default. Tab, market and period MUST be kept in the URL as `aba`, `mercado`, `de` and `ate`. Opening a URL with those values MUST restore them. A `mercado` outside the session MUST be replaced by the session default.

#### Scenario: Shared link restores the view

- **WHEN** an admin opens `/reports?aba=assinaturas&mercado=US&de=2026-07-01&ate=2026-09-30`
- **THEN** Assinaturas is selected, Estados Unidos is pressed, and the period shows 01/07/2026 to 30/09/2026

#### Scenario: Out-of-scope market in the URL

- **WHEN** an operator assigned `BR` opens `/reports?mercado=US`
- **THEN** the page uses Brasil and does not call any report route with `market=US`

### Requirement: Period control

The period control MUST offer 7 dias, 30 dias, 90 dias, 12 meses and Personalizado, defaulting to 30 dias. Quick periods MUST end yesterday, matching the API default. Personalizado MUST show De and Até date fields and MUST NOT allow more than 366 days or a start after the end. Granularity MUST default to the API's choice and MUST offer Dia, Semana and Mês. The subtitle MUST name the market and the date range and MUST NOT include a clock time.

#### Scenario: Custom range over a year is blocked

- **WHEN** the user picks De 01/01/2025 and Até 28/10/2026
- **THEN** the page shows a validation message and sends no request

#### Scenario: Subtitle names market and dates

- **WHEN** a BR operator views the default period on 2026-10-28
- **THEN** the subtitle names Brasil and 28/09/2026 to 27/10/2026 and has no time of day

### Requirement: Summary compares markets side by side

The Resumo tab MUST call `GET /admin/reports/summary` and render one column per market returned, Brasil before Estados Unidos, each in its own currency. It MUST NOT show any total that adds both markets. A single-market session MUST see only its own column.

#### Scenario: Admin comparison

- **WHEN** an admin with both markets opens Resumo
- **THEN** a Brasil column in R$ and an Estados Unidos column in US$ are shown with the same KPI rows, and no Total column exists

#### Scenario: Operator US summary

- **WHEN** an operator assigned `US` opens Resumo
- **THEN** only the Estados Unidos column is shown

### Requirement: Cards show the change against the previous period

Each period KPI card MUST show the value and the change against `previous`: a percentage for counts and money, percentage points for rates. When `previous` is `null` or zero the change MUST be omitted. Point-in-time cards MUST say **agora** instead of a change.

#### Scenario: Revenue up

- **WHEN** revenue is `1000000` and previous is `800000` in BRL
- **THEN** the card shows `R$ 10.000,00` and `+25,0%` against the previous period

#### Scenario: No previous value

- **WHEN** previous paid invoices is `0`
- **THEN** the paid invoices card shows its value and no percentage

### Requirement: Report tab contents

Receita MUST show **Faturamento bruto** (with a hint that taxes and shipping are included and refunds are not deducted), faturas pagas, ticket médio, MRR estimado (badge **Estimado**, with trialing and unpriced counts), the first purchase versus renewal split, and the series. Assinaturas MUST show the current status cards, novas, canceladas, ativas no início, churn and the series of novas and cancelamentos. Aquisição MUST show Checkouts iniciados, Vinculados ao Stripe and Chegaram a ativar with conversions. Mix MUST show recipes as bars and packs as a table. Operação MUST show cycles by status, atrasados and, for Estados Unidos only, UPS shipments. Estoque MUST show the table per recipe and pack with produzido, separado, ajustado, saldo and mínimo, with a total row.

#### Scenario: Brazil operations hides UPS

- **WHEN** a BR session opens Operação
- **THEN** the UPS shipments block is absent

#### Scenario: Approximate cancellations warning

- **WHEN** the subscriptions report returns `approximateCanceledCount` `3`
- **THEN** Assinaturas shows a note that 3 cancellations have an approximate date

#### Scenario: Unpaid renewals are apart from late cycles

- **WHEN** the operations report returns `awaitingPayment` `7` and `late` `1`
- **THEN** Operação shows **Aguardando pagamento** 7 as its own card and **Atrasados** 1, and the cycle status counts do not include the 7

#### Scenario: Excluded invoices warning

- **WHEN** the revenue report returns `excludedInvoices` `1`
- **THEN** Receita shows a note that 1 invoice in another currency was left out

### Requirement: Admins see checkouts without a market

When the acquisition report returns `unassignedCheckouts` greater than zero, Aquisição MUST show a note with that count saying those checkouts have no market and are outside the funnel. The panel MUST NOT add them to any stage. The field only comes for admins, so other sessions never see the note.

#### Scenario: Admin with unassigned checkouts

- **WHEN** an admin opens Aquisição and the API returns `unassignedCheckouts` `4`
- **THEN** a note says 4 checkouts of the period have no market and are not in the funnel

### Requirement: Mix shows every recipe and pack size

Mix MUST list every recipe the API returns. A recipe with `nameMissing: true` MUST show its key with the mark **sem nome no catálogo EUA** (or **Brasil**). Packs MUST be one row per size, with the `label` from the API as is (US labels already carry the grams, as `17.6 oz (499 g)`). The same mark MUST appear on Estoque rows with `nameMissing: true`.

#### Scenario: US recipe without a name

- **WHEN** the US mix returns `{ key: 'bovino', name: 'bovino', nameMissing: true }`
- **THEN** the bar is labelled `bovino` with the mark **sem nome no catálogo EUA**

### Requirement: CSV export follows permission

**Exportar CSV** MUST appear only when the session has `reports.export`. It MUST download `GET /admin/reports/export.csv` with the current tab as `report`, `formato=excel`, and the same market and period, using the file name the API returns.

#### Scenario: Readonly has no export

- **WHEN** a readonly session opens `/reports`
- **THEN** **Exportar CSV** is absent

#### Scenario: Operator exports the current tab

- **WHEN** an operator on Estoque for Brasil presses **Exportar CSV**
- **THEN** the panel requests `export.csv` with `report=stock&market=BR&formato=excel` and the current `from`/`to`

### Requirement: Partial periods are marked

Series buckets with `partial: true` MUST be drawn with a lighter or hatched bar and a tooltip saying **período parcial**. When `period.partialToday` is `true`, the subtitle MUST say that today is compared up to the same time in the previous period.

#### Scenario: Partial edge month

- **WHEN** a monthly revenue series returns March with `partial: true`
- **THEN** the March bar is visually distinct and its tooltip says **período parcial**

#### Scenario: Custom range ending today

- **WHEN** the user picks Até as today
- **THEN** the subtitle notes that today is compared up to the same time

### Requirement: Report errors stay visible

When a report request fails with `403` (`market_forbidden`, `market_required` or a missing permission), `400` (`report_market_required`, `report_period_invalid`) or `503` (`report_timeout`), the tab MUST show the API message in `div.alert` and MUST NOT render zero-valued cards in its place.

#### Scenario: Timeout shows an alert

- **WHEN** the revenue route responds `503` with code `report_timeout`
- **THEN** Receita shows the alert and no revenue card with `R$ 0,00`

### Requirement: Report numbers and charts follow the overview style

Quantities, money and percentages MUST use `tabular-nums` and pt-BR separators. Brasil money MUST use `R$` and Estados Unidos money `US$`, converted from minor units. Charts MUST be CSS bars with the panel accent for the main series and gray for the comparison, with a tooltip holding the exact value when the number is not printed next to the bar. Status colors MUST NOT be used as a chart series. Every chart MUST have an `aria-label` with its totals.

#### Scenario: US money format

- **WHEN** US revenue is `1234567` minor units
- **THEN** the card shows `US$ 12.345,67`
