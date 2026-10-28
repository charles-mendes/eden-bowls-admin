# operations/business-overview Specification

## Purpose
Mostra à operação e ao cliente uma visão de receita, assinaturas, funil e mix por mercado, nesta fase só no build de demonstração, com dados fictícios, sem misturar as moedas e sem depender de API nova.

## Requirements

### Requirement: The page exists only in the demo build

The menu item and the page MUST render only when `VITE_DEMO_INSIGHTS` is the string `true`. Otherwise the item MUST be absent for every role, and an operational session that opens `/insights` MUST be redirected to `/dashboard` without rendering demonstration numbers.

#### Scenario: Unset flag hides the page

- **WHEN** the variable is unset and an operator opens the sidebar and then `/insights`
- **THEN** **Visão do negócio** is absent and the operator lands on `/dashboard` without the demonstration MRR

#### Scenario: Demo build lists the item next to Hoje

- **WHEN** the variable is `true` and an operator opens the sidebar
- **THEN** Visão geral contains **Hoje** and **Visão do negócio**, in that order

### Requirement: Veterinarian-only sessions never see the page

A veterinarian-only session MUST NOT see the menu item. Opening `/insights` MUST redirect to `/nutrition/simulate`, the same guard used for other operational routes, and MUST NOT render the demonstration page. This holds with the demo flag on or off.

#### Scenario: Direct URL stays on the simulator

- **WHEN** a veterinarian-only session opens `/insights`
- **THEN** the panel shows the nutrition simulator and does not show **Dados de demonstração**

### Requirement: The page is demonstration data

When the demo flag is on, the page MUST show the badge **Dados de demonstração**. Every number MUST come from the demonstration fixture. The page MUST NOT call `apiRequest` for these metrics. The subtitle MUST name the market and the period and MUST NOT include a clock time.

#### Scenario: Badge is visible and metrics stay local

- **WHEN** an operator opens `/insights` with the demo flag on
- **THEN** the badge **Dados de demonstração** is visible and the page does not call `apiRequest` for its metrics

#### Scenario: Subtitle has no clock

- **WHEN** an operator views the page on Brasil and 30 dias
- **THEN** the subtitle names Brasil and the last 30 days and does not contain a time of day

### Requirement: Sections follow the prototype order

The page MUST render, in this order: the **Hoje na operação** strip, **Receita**, the five subscription cards, **Tendência semanal**, **Funil de aquisição**, and **Mix das próximas entregas**.

#### Scenario: Order on first visit

- **WHEN** an operator opens `/insights` with the demo flag on
- **THEN** the headings appear in that order, with the Hoje strip above Receita

### Requirement: Today strip links to Hoje

The Hoje strip MUST show demonstration counts for atrasados, pagamentos recusados and sem etiqueta UPS, using status colors only on those dots. The strip MUST be a link to `/dashboard`. Those counts MUST NOT change with the period.

#### Scenario: Strip opens Hoje

- **WHEN** an operator activates **Abrir Hoje**
- **THEN** the panel navigates to `/dashboard`

### Requirement: Revenue and subscription cards match the prototype

**Receita** MUST show MRR, faturamento no período, ticket médio and churn no período, each with a delta versus the previous period. **Assinaturas** MUST show Ativas, Cancelando, Em atraso, Renovam em 7 dias and Canceladas. **Ver assinantes** MUST go to `/billing`. The Renovam em 7 dias marker MUST be gray and MUST NOT use the accent or the info blue.

#### Scenario: Revenue labels are present

- **WHEN** an operator opens `/insights` on Brasil and 30 dias
- **THEN** the four Receita cards and the five Assinaturas cards are visible

#### Scenario: Assinantes link

- **WHEN** an operator activates **Ver assinantes**
- **THEN** the panel navigates to `/billing`

### Requirement: The period scales only a fixed set of figures

The period control MUST offer 7 dias, 30 dias and 90 dias, defaulting to 30 dias. The factors 0.25, 1 and 2.9 MUST apply only to faturamento no período, canceladas, churn and the three funnel counts. MRR, ticket médio, the other subscription cards, the four deltas, the Hoje strip, the eight-week trend, the mix and the simplified-checkout share MUST stay fixed. Funnel conversion rates MUST stay fixed because every stage uses the same factor. The trend label MUST stay **últimas 8 semanas** on every period.

#### Scenario: Seven days scales billing and the funnel only

- **WHEN** the operator is on Brasil 30 dias and presses 7 dias
- **THEN** faturamento no período and the funnel counts are smaller, MRR is unchanged, and the trend still says últimas 8 semanas

### Requirement: Weekly trend is grouped bars

**Tendência semanal** MUST show the last eight weeks as grouped bars: novas in the accent color and cancelamentos in gray. The chart MUST expose `aria-label` with the totals and a tooltip on each week group with the exact counts.

#### Scenario: Trend has two series and a tooltip

- **WHEN** an operator views the trend
- **THEN** the legend lists Novas and Cancelamentos, the chart name includes both totals, and a week group exposes its exact counts in a tooltip

### Requirement: Funnel shows conversion between stages

**Funil de aquisição** MUST show Checkouts iniciados, Vinculados ao Stripe and Assinaturas ativas as horizontal bars, with the conversion rate between consecutive stages and the count printed beside each bar. **Ver checkouts** MUST go to `/onboarding/sessions`. These bars MUST NOT require a tooltip.

#### Scenario: Conversion sits between stages

- **WHEN** an operator views the funnel
- **THEN** a conversion percentage appears between stage 1 and 2 and between stage 2 and 3, and each stage shows its count as text

### Requirement: Mix shows flavors and packs

**Mix das próximas entregas** MUST list flavors as horizontal bars with the quantity printed beside each bar, and packs in a table of assinantes, participação and ticket. Flavor and pack names MUST follow the selected market language. Mix bars MUST NOT require a tooltip.

#### Scenario: Brasil mix is Portuguese

- **WHEN** the market is Brasil
- **THEN** flavor names are in Portuguese and pack names use refeições / semana

#### Scenario: EUA mix is English

- **WHEN** the market is EUA
- **THEN** flavor names are in English and pack names use meals / week

### Requirement: Market filter has no Todos and is omitted for one market

The page MUST offer Brasil and EUA when the session has both markets, defaulting to Brasil, and MUST NOT offer Todos. A single-market session MUST omit the control. The subtitle MUST name that market.

#### Scenario: Dual-market admin has no Todos

- **WHEN** an admin with both markets opens `/insights` with the demo flag on
- **THEN** the market group is Brasil and EUA, Brasil is pressed, and Todos is absent

#### Scenario: BR operator has no market control

- **WHEN** an operator assigned only `BR` opens `/insights` with the demo flag on
- **THEN** the market control is absent, the subtitle names Brasil, and EUA is not offered

### Requirement: Numbers use tabular pt-BR

Visible quantities, money and percentages MUST use `tabular-nums` and Portuguese-Brazil grouping and decimal separators. Brasil money MUST use `R$`. EUA money MUST use `US$` with the same pt-BR number format.

#### Scenario: Thousands use a period

- **WHEN** Brasil MRR is 241390
- **THEN** the card shows `R$ 241.390`

### Requirement: Charts stay bars with accent and gray

Charts MUST be CSS bars, not pie or 3D. The primary series MUST use the panel accent. The comparison series MUST use gray. Status colors MUST NOT be used as a chart series. A tooltip with the exact value is required only where the number is not already printed beside the mark.

#### Scenario: Trend comparison is gray

- **WHEN** an operator inspects the weekly trend
- **THEN** cancelamentos are gray and the bars are not pie slices

### Requirement: Phase 2 labels stay off unless the demo walkthrough asks

Labels **Fase 2** MUST be absent unless the demo flag is on and the URL has `fase2=1`. That query is an accepted demo-only exception. When both are set, the labels MUST mark Receita, Tendência semanal and Mix das próximas entregas only. An operator MAY see them; they are not limited to admin.

#### Scenario: Default demo visit hides Phase 2

- **WHEN** an operator opens `/insights` with the demo flag on and without the query
- **THEN** no **Fase 2** badge is rendered

#### Scenario: Walkthrough query shows the three badges

- **WHEN** an operator opens `/insights?fase2=1` with the demo flag on
- **THEN** Receita, Tendência semanal and Mix das próximas entregas each show a **Fase 2** badge

#### Scenario: Query does nothing without the demo flag

- **WHEN** an operator opens `/insights?fase2=1` with the flag unset
- **THEN** the panel redirects to `/dashboard` and renders no **Fase 2** badge
