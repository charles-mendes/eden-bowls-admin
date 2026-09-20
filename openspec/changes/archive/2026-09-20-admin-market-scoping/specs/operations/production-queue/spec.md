# Spec Delta

## MODIFIED Requirements

### Requirement: Queue items expose kitchen-ready pack and flavor mix

Each queue item MUST support these grid columns, in order: Vencimento (datetime + due badge); Cliente (ledger snapshot: email, plus name from the row address when present — not a live WordPress `displayName`); Pets + mix de sabores × quantidade; Packs (sum of quantities) + tamanho (`500 g` or “misto”); Plano (`plan_label` + term); País / cidade; Pagamento (Stripe status); Produção (badge); Ações (status advance when permitted; link Assinante / Cliente and link Onboarding 360 only when `customerProfileInScope` is true). When `customerProfileInScope` is false, Cliente identity MUST remain visible as text without those links. Plan subtotal MUST appear only when `catalog_pricing.subtotal` exists. Packs and flavors MUST come from `plan_selection.catalog_pricing.line_items` when present, else `pets[].selected_flavors` / `flavor_weights`.

#### Scenario: Line items drive packs and flavors

- **WHEN** `catalog_pricing.line_items` contains two beef 500 g packs and one turkey 500 g pack
- **THEN** the item shows flavor mix “beef × 2, turkey × 1”, pack count 3, size “500 g”, and `lineItems.length` 2 or 3 according to the snapshot lines

#### Scenario: Mixed pack sizes are dense

- **WHEN** line items include both 500 g and another pack size
- **THEN** pack size is “misto” and the mix is dense

#### Scenario: Missing subtotal

- **WHEN** `catalog_pricing.subtotal` is absent
- **THEN** the value shows a placeholder, not zero invented from other fields

#### Scenario: Cliente uses ledger identity

- **WHEN** a queue item has ledger email `ana@edenbowls.com` and a WordPress display name that differs
- **THEN** the Cliente column shows the ledger email (and snapshot name when present), not the live WordPress display name

#### Scenario: Out-of-scope profile hides Onboarding 360

- **WHEN** a queue item has `customerProfileInScope` false
- **THEN** Onboarding 360 and Assinante/Cliente are not links

### Requirement: Production screen is an Operação queue for kitchen staff

The admin app MUST expose **Produção** at `/operations/production` in the Operação menu for `admin`, `operator`, and `readonly`, and MUST hide it from nutritionist-only accounts. The page MUST show four metric cards bound to `metrics`: Vence hoje (`today`), Amanhã (`tomorrow`), Próximos Nd (`upcoming`, N = `windowDays`), Atrasados (`overdue`). Filters: window 7/14/30, account (admin: todas|BR|US; single-market staff: only their Stripe account, locked), production status todos|a preparar|em produção|pronto|bloqueado, search `q`, include overdue, clear. Single-market staff MUST send their account on every queue request and MUST NOT be able to select the other account. The table MUST use the grid columns defined above, group visible rows by `dueBucket`, and MUST NOT display last4, street, or postal code. Empty state MUST read “Nenhuma renovação nesta janela.” Loading MUST use the panel table skeleton. Errors MUST render in `div.alert`. Callers with `production.write` MUST see status-advance actions; others MUST not. Dense mix MAY open a dialog of `lineItems`. Blocking MUST prompt for a required note.

#### Scenario: Operator opens Produção

- **WHEN** an operator with `production.read` opens `/operations/production`
- **THEN** they see the four KPIs, filters, and the grid columns of due subscriptions

#### Scenario: Nutritionist cannot reach the screen via the menu

- **WHEN** a nutritionist-only session loads the shell
- **THEN** Produção is absent from the menu and the only Operação item remains the nutrition simulator

#### Scenario: Readonly can view but not change status

- **WHEN** a readonly user opens Produção
- **THEN** the queue is visible with the same columns (no street/last4) and status-advance controls are hidden

#### Scenario: Empty window

- **WHEN** the API returns zero items for the current filters
- **THEN** the page shows “Nenhuma renovação nesta janela.”

#### Scenario: Operator BR cannot list the US queue

- **WHEN** an operator assigned `BR` opens Produção
- **THEN** the account filter is locked to BR, “Todas” is absent, and the queue request sends `account=br`
