# operations/business-overview Specification

## Purpose
Mostra à operação uma visão de receita, assinaturas, funil e mix por mercado, com dados reais da API de relatórios (`/api/v1/admin/reports/*`), que lê o MySQL e o espelho das faturas e assinaturas do Stripe. Não mistura moedas e não tem dados de demonstração.

## Requirements

### Requirement: The page follows the reports permission

The menu item **Visão do negócio** MUST appear in Visão geral, right after **Hoje** and before **Relatórios**, only for sessions with role `admin`, `operator` or `readonly` and with permission `reports.read`. A session without `reports.read` that opens `/insights` MUST be redirected to `/dashboard`. A veterinarian-only session MUST be redirected to `/nutrition/simulate` by the operational route guard.

#### Scenario: Operator with reports.read

- **WHEN** an operator with `reports.read` opens the sidebar
- **THEN** Visão geral lists **Hoje**, **Visão do negócio** and **Relatórios**, in that order

#### Scenario: No reports.read

- **WHEN** a session without `reports.read` opens `/insights`
- **THEN** the panel lands on `/dashboard`

### Requirement: Every number comes from the reports API

The page MUST load, for the selected market, `revenue`, `subscriptions` (`granularity=week`) and `acquisition` for the selected period, `mix` without a period, and `operations` for today in the market time zone. The page MUST NOT contain fixture numbers. When a request fails, the page MUST show the error and no figures.

#### Scenario: Requests for Brasil 30 dias

- **WHEN** a BR operator opens `/insights` on 2026-10-28
- **THEN** the page calls the five reports with `market=BR`, the period 2026-09-28 to 2026-10-27, and operations for 2026-10-28

#### Scenario: API error

- **WHEN** the reports API responds with an error
- **THEN** the page shows an alert and no metric card

### Requirement: Period and market controls

The period control MUST offer 7 dias, 30 dias and 90 dias, defaulting to 30 dias, each ending yesterday in the market time zone. The subtitle MUST name the market and the dates, without a clock time. The market control MUST offer Brasil and Estados Unidos only when the session has both markets, defaulting to the session default, and MUST NOT offer Todos.

#### Scenario: Seven days reloads

- **WHEN** the operator presses 7 dias on 2026-10-28
- **THEN** the reports are requested again for 2026-10-21 to 2026-10-27

### Requirement: Sections

The page MUST render, in this order: the **Hoje na operação** strip (atrasados, aguardando pagamento and bloqueados, linking to `/dashboard`), **Receita** (receita recorrente estimada, faturamento bruto, ticket médio, churn), **Assinaturas** (ativas, cancelando, pagamento pendente, renovam em 7 dias, canceladas no período, with **Ver assinantes** to `/billing`), **Tendência semanal** (novas and cancelamentos per week, grouped bars with a tooltip per week), **Funil de aquisição** (checkouts iniciados, vinculados, ativadas, with conversion between stages and **Ver checkouts** to `/onboarding/sessions`) and **Mix das assinaturas ativas** (flavors and pack sizes). Period cards MUST show the change against the previous period; point-in-time cards MUST say `agora`. Receita recorrente MUST carry the **Estimado** badge.

#### Scenario: Order on first visit

- **WHEN** an operator opens `/insights`
- **THEN** the headings are Receita, Assinaturas, Tendência semanal, Funil de aquisição and Mix das assinaturas ativas, with the Hoje strip above Receita

### Requirement: Numbers use tabular pt-BR

Money MUST come from minor units and use pt-BR formatting with `R$` for Brasil and `US$` for Estados Unidos. Counts and rates MUST use pt-BR separators.

#### Scenario: Gross revenue

- **WHEN** BR gross revenue is `1000000` minor units
- **THEN** the card shows `R$ 10.000,00`
