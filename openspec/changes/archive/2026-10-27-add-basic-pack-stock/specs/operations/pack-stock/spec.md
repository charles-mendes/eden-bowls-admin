# Spec Delta

## Purpose

Gives the kitchen one screen to see ready-pack stock against the packs the upcoming deliveries need, record production and adjustments, and trace every stock change.

## ADDED Requirements

### Requirement: Estoque menu item

The admin app MUST expose **Estoque** at `/operations/stock` in the Operação menu for `admin`, `operator` and `readonly`, and MUST hide it from veterinarian-only accounts.

#### Scenario: Operator sees Estoque

- **WHEN** an operator loads the shell
- **THEN** Estoque appears in the Operação group and opens `/operations/stock`

#### Scenario: Veterinarian does not see Estoque

- **WHEN** a veterinarian-only session loads the shell
- **THEN** Estoque is absent from the menu

### Requirement: Stock overview table

The page MUST load `GET /api/v1/admin/stock` and show one row per recipe and pack size with Receita, Tamanho, Em estoque, Comprometido (with the part awaiting payment as a subline), Disponível, A produzir and Mínimo. Rows with negative available or `belowMinimum` true MUST be highlighted with the semantic warning colour. Rows MUST be sorted by A produzir descending, then recipe.

#### Scenario: Kitchen sees what to produce

- **WHEN** the API returns `frango / 300 g` with on-hand 40, committed 55, awaiting payment 10, available -15 and to produce 15
- **THEN** the row shows those numbers, "10 aguardando pagamento" under Comprometido, and is highlighted

#### Scenario: Empty market

- **WHEN** the API returns no items
- **THEN** the page shows "Nenhum item de estoque nem entrega nesta janela."

### Requirement: Lines without pack size are flagged

When the overview returns a non-empty `unsizedLines`, the page MUST show a warning above the table stating that those packs are not in Comprometido, listing each line's recipe or label and quantity with a link to its subscription detail.

#### Scenario: Delivery with an unsized line

- **WHEN** the overview returns `unsizedLines` with subscription 123, `frango` and 3
- **THEN** the page warns "3 packs sem tamanho não entram no comprometido" and links `frango × 3` to subscription 123

#### Scenario: No unsized lines

- **WHEN** `unsizedLines` is empty
- **THEN** no unsized warning is shown

### Requirement: Window and market filters

The page MUST offer a window of 7, 14 or 30 days (default 7) and a market filter. Admins MUST choose BR or US (default BR). Single-market staff MUST have the filter locked to their market and every request MUST send it.

#### Scenario: Operator BR is locked

- **WHEN** an operator assigned `BR` opens Estoque
- **THEN** the market filter shows BR, cannot change, and requests send `market=BR`

### Requirement: Record production and adjust

Callers with `production.write` MUST see "Lançar produção" and, per row, "Ajustar" and "Definir mínimo". Lançar produção MUST ask recipe, size, quantity (1–10000) and optional note. Ajustar MUST ask a non-zero signed quantity and a reason (Perda, Vencimento, Contagem, Amostra, Outro), with note required for Outro. After success the table MUST reload. API errors MUST show in `div.alert` inside the dialog.

#### Scenario: Record a batch

- **WHEN** an operator records 30 packs of `carne / 500 g`
- **THEN** the request posts to `/api/v1/admin/stock/production` and the row shows on-hand 30 higher after reload

#### Scenario: Unknown size from the API

- **WHEN** the API answers `422 stock_item_unknown`
- **THEN** the dialog stays open and shows "Essa receita e tamanho não existem no catálogo deste mercado."

#### Scenario: Readonly sees no actions

- **WHEN** a readonly user opens Estoque
- **THEN** the table is visible and Lançar produção, Ajustar and Definir mínimo are hidden

### Requirement: Movement history

The page MUST show the market's movements from `GET /api/v1/admin/stock/movements`, newest first, paginated, filterable by item and type. Each row MUST show date, item, type (Produção, Separação, Estorno, Ajuste), signed quantity, reason and note, and the author or, for Separação and Estorno, a link to the subscription.

#### Scenario: Separation links to the subscription

- **WHEN** the history contains a separation movement for subscription 123
- **THEN** the row reads "Separação", shows the negative quantity, and links to that subscription detail
