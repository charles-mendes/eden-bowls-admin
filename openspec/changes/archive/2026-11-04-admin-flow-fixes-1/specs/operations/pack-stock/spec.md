# Spec Delta

## MODIFIED Requirements

### Requirement: Record production and adjust

Callers with `production.write` MUST see "Lançar produção" and, per row, "Lançar produção", "Contagem", "Ajustar" and "Definir mínimo". Lançar produção MUST ask recipe, size, quantity (1–10000) and optional note. Contagem MUST ask the counted total (0–10000) and optional note, MUST state that the system records only the difference from the current stock, and the API MUST compute the difference under the item lock and record it as an adjustment with reason Contagem. Ajustar MUST ask a non-zero signed quantity and a reason (Perda, Vencimento, Amostra, Outro), with note required for Outro. After success the table MUST reload. API errors MUST show in `div.alert` inside the dialog.

#### Scenario: Record a batch

- **WHEN** an operator records 30 packs of `carne / 500 g` with Lançar produção
- **THEN** the request posts to `/api/v1/admin/stock/production` and the row shows on-hand 30 higher after reload

#### Scenario: Unknown size from the API

- **WHEN** the API answers `422 stock_item_unknown`
- **THEN** the dialog stays open and shows "Essa receita e tamanho não existem no catálogo deste mercado."

#### Scenario: Count explains the difference

- **WHEN** an operator opens Contagem for an item with 12 packs on hand
- **THEN** the dialog says the system records only the difference between the counted total and 12

#### Scenario: Readonly sees no actions

- **WHEN** a readonly user opens Estoque
- **THEN** the table is visible and Lançar produção, Contagem, Ajustar and Definir mínimo are hidden

### Requirement: Window and market filters

The page MUST offer a window of 7, 14 or 30 days (default 7) and a market filter. Admins MUST choose BR or US (default BR). Single-market staff MUST have the filter locked to their market and every request MUST send it. The window (`janela`), the admin's market (`mercado`), the status filter (`situacao`) and the search (`busca`) MUST be read from and written to the URL; an unknown or out-of-scope value MUST fall back to the default.

#### Scenario: Operator BR is locked

- **WHEN** an operator assigned `BR` opens Estoque
- **THEN** the market filter shows BR, cannot change, and requests send `market=BR`

#### Scenario: Link with filters

- **WHEN** an admin opens `/operations/stock?mercado=US&janela=14&busca=frango`
- **THEN** the market shows US, the window shows 14 days and the search shows "frango"

## ADDED Requirements

### Requirement: Initial count hint

When the selected market has no stock movement at all, callers with `production.write` MUST see a notice above the table saying to start with the initial count of each item, with the Contagem action at hand.

#### Scenario: Market without movements

- **WHEN** an operator opens Estoque for a market whose movement history is empty
- **THEN** a notice asks for the initial count before production is recorded

#### Scenario: Market with movements

- **WHEN** the market has at least one movement
- **THEN** no initial count notice is shown
