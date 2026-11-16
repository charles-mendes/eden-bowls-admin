# Spec Delta

## ADDED Requirements

### Requirement: Menu items follow the session's markets

The menu MUST show Etiquetas UPS only when the session's effective markets include `US`, and Entregas Brasil and Notas fiscais only when they include `BR`. Every other item MUST keep today's rule. Effective markets MUST come from `effectiveMarkets` in `GET /api/v1/admin/me`; when the field is absent, the panel MUST use `markets`, and when both are empty it MUST show every market item.

#### Scenario: Brazil operator

- **WHEN** an operator whose effective markets are `["BR"]` signs in
- **THEN** the menu shows Entregas Brasil and Notas fiscais and hides Etiquetas UPS

#### Scenario: US operator

- **WHEN** an operator whose effective markets are `["US"]` signs in
- **THEN** the menu shows Etiquetas UPS and hides Entregas Brasil and Notas fiscais

#### Scenario: Operator without a stored market

- **WHEN** `/admin/me` returns `markets: []` and `effectiveMarkets: ["BR", "US"]`
- **THEN** the menu shows the items of both markets and Hoje shows the card "Sem etiqueta UPS"

### Requirement: A screen of another market says so

Opening by URL Etiquetas UPS without the `US` effective market, or Entregas Brasil or Notas fiscais without `BR`, MUST show "Esta tela é do mercado Estados Unidos" or "Esta tela é do mercado Brasil" with a link to Hoje, and MUST NOT request the list. API protection MUST remain unchanged.

#### Scenario: Brazil operator opens the label queue

- **WHEN** an operator whose effective markets are `["BR"]` opens `/operations/labels`
- **THEN** the page says "Esta tela é do mercado Estados Unidos" and no label queue request is sent
