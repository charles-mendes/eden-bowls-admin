# operations/pack-stock Specification

## Purpose

Gives the kitchen one screen to see ready-pack stock against the packs the upcoming deliveries need, record production and adjustments, and trace every stock change.

## Requirements

### Requirement: Estoque menu item

The admin app MUST expose **Estoque** at `/operations/stock` in the Operação menu for `admin`, `operator` and `readonly`, and MUST hide it from veterinarian-only accounts.

#### Scenario: Operator sees Estoque

- **WHEN** an operator loads the shell
- **THEN** Estoque appears in the Operação group and opens `/operations/stock`

#### Scenario: Veterinarian does not see Estoque

- **WHEN** a veterinarian-only session loads the shell
- **THEN** Estoque is absent from the menu

### Requirement: Stock overview table

The page MUST load `GET /api/v1/admin/stock` and show one row per recipe and pack size with Receita, Tamanho, Em estoque, Comprometido (with the part awaiting payment as a subline), Disponível, A produzir and Mínimo. Rows with negative available or `belowMinimum` true MUST be highlighted with the semantic warning colour. Rows MUST be sorted by A produzir descending, then recipe. The overview MUST list every published catalog recipe and size of the market, with zero stock when it has no stored item, and MUST NOT add unpublished ones unless they already have stock, a minimum or demand.

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

The page MUST offer a window of 7, 14 or 30 days (default 7) and a market filter. Admins MUST choose BR or US (default BR). Single-market staff MUST have the filter locked to their market and every request MUST send it. The window (`janela`), the admin's market (`mercado`), the status filter (`situacao`) and the search (`busca`) MUST be read from and written to the URL; an unknown or out-of-scope value MUST fall back to the default.

#### Scenario: Operator BR is locked

- **WHEN** an operator assigned `BR` opens Estoque
- **THEN** the market filter shows BR, cannot change, and requests send `market=BR`

#### Scenario: Link with filters

- **WHEN** an admin opens `/operations/stock?mercado=US&janela=14&busca=frango`
- **THEN** the market shows US, the window shows 14 days and the search shows "frango"

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

### Requirement: Movement history

The page MUST show the market's movements from `GET /api/v1/admin/stock/movements`, newest first, paginated, filterable by item and type. Each row MUST show date, item, type (Entrada, Separação, Estorno, Ajuste), signed quantity, reason and note, and the author or, for Separação and Estorno, a link to the subscription.

#### Scenario: Separation links to the subscription

- **WHEN** the history contains a separation movement for subscription 123
- **THEN** the row reads "Separação", shows the negative quantity, and links to that subscription detail

### Requirement: Initial count hint

When the selected market has no stock movement at all, callers with `production.write` MUST see a notice above the table saying to start with the initial count of each item, with the Contagem action at hand.

#### Scenario: Market without movements

- **WHEN** an operator opens Estoque for a market whose movement history is empty
- **THEN** a notice asks for the initial count before production is recorded

#### Scenario: Market with movements

- **WHEN** the market has at least one movement
- **THEN** no initial count notice is shown
