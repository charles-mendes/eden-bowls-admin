# Spec Delta

## ADDED Requirements

### Requirement: Reports market picker follows the session

The Relatórios market control MUST only offer markets in the session and MUST NOT offer Todos. It MUST default to Brasil when the session has both markets. Staff with one market MUST have the control omitted, MUST send their own market on every report request, and the page subtitle MUST name that market. The Resumo tab is the only place where both markets appear at once.

#### Scenario: Admin with both markets has no Todos

- **WHEN** an admin with `BR` and `US` opens `/reports?aba=receita`
- **THEN** the market group offers Brasil and Estados Unidos, Brasil is pressed, and Todos is absent

#### Scenario: BR operator has no market control

- **WHEN** an operator assigned only `BR` opens `/reports?aba=receita`
- **THEN** the market control is absent, the subtitle names Brasil, and every report request sends `market=BR`
