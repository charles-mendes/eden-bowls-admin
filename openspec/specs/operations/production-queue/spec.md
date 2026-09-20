# operations/production-queue Specification

## Purpose

Gives kitchen operators a queue of Stripe subscriptions due soon, with pack/flavor mix from the persisted checkout snapshot and a per-cycle production status overlay that does not duplicate the billing ledger.

## Requirements

### Requirement: Queue membership follows live Stripe ledger status

The system SHALL include a subscription in the production queue when all of the following are true: Stripe status is `active`, `trialing`, or `past_due`; `cancel_at_period_end` is false; `current_period_end` is present; and the period end falls in the selected civil window (today through today + windowDays, or overdue when enabled). The system MUST exclude `paused`, `canceled`, `incomplete`, `incomplete_expired`, and any row with `cancel_at_period_end` true. Each ledger subscription MUST appear at most once per page (one cycle per `stripe_subscriptions.id`).

#### Scenario: Active subscription with a period end is queued

- **WHEN** an `active` subscription has `cancel_at_period_end` false and a period end inside the selected window
- **THEN** that subscription appears exactly once in the queue

#### Scenario: Past-due still needs a bowl

- **WHEN** an otherwise eligible subscription is `past_due`
- **THEN** it remains in the queue and the payment column shows the past-due Stripe status

#### Scenario: Cancel-at-period-end stays out

- **WHEN** an otherwise eligible subscription has `cancel_at_period_end` true
- **THEN** it is absent from the queue

#### Scenario: Canceled and incomplete stay out

- **WHEN** a subscription is `canceled`, `paused`, `incomplete`, or `incomplete_expired`
- **THEN** it is absent from the queue even if `current_period_end` falls in the window

### Requirement: Civil window includes today even after the UTC timestamp

The system SHALL default `windowDays` to 7 and MUST accept 7, 14, or 30. Window membership MUST use civil dates in the query timezone (default `America/Sao_Paulo`): period end on today through today + `windowDays` days, inclusive of today even when `current_period_end` is already earlier than UTC now. Query `includeOverdue` defaults to true. When true, overdue rows are those whose civil date is before today, production status is not `ready`, and period end is not older than `windowDays` before today. `includeOverdue=0` MUST omit overdue rows and MUST NOT omit civil-today rows. When Stripe advances `current_period_end` out of the window, the previous cycle MUST leave the queue.

#### Scenario: Default 7-day civil window

- **WHEN** an operator loads the queue with no window query
- **THEN** in-window rows are those whose period-end civil date is today through 7 days ahead in the query timezone

#### Scenario: Period end earlier today is still today

- **WHEN** period end is earlier than UTC now but still today’s civil date in `America/Sao_Paulo`
- **THEN** the row is in the queue, `dueBucket` is `today`, and `includeOverdue=0` does not hide it

#### Scenario: Overdue capped and optional

- **WHEN** `includeOverdue` is true and a non-ready subscription’s civil period date is 3 days before today with `windowDays=7`
- **THEN** it appears as overdue; a non-ready row 10 days before today does not; `includeOverdue=0` hides overdue rows

#### Scenario: Renewal advances the period end

- **WHEN** a ledger update moves `current_period_end` outside the current window
- **THEN** that subscription disappears from the current window and, if still eligible, the new period appears as `to_prepare`

### Requirement: Calendar buckets are disjoint civil days

The system SHALL compute `daysUntil` as the difference in civil calendar dates in the query timezone. US account filter MUST still default buckets to `America/Sao_Paulo` when timezone is omitted. Each item MUST expose `dueBucket` of `overdue` (`daysUntil < 0`), `today` (`0`), `tomorrow` (`1`), or `upcoming` (`> 1`), and labels: 0 → “Vence hoje”; 1 → “Amanhã”; `> 1` → “Faltam N dias”; `< 0` → “Atrasado N dias”.

#### Scenario: Same civil day is today even if hours remain

- **WHEN** period end is later today in `America/Sao_Paulo`
- **THEN** `daysUntil` is 0, `dueBucket` is `today`, and the label is “Vence hoje”

### Requirement: Operators can list a flattened production queue

Authorized callers MUST retrieve the queue via `GET /api/v1/admin/production/queue` with `production.read`. Query parameters: `windowDays` (7|14|30, default 7), `includeOverdue` (default true), `account`, `productionStatus`, `q` (email, `sub_`, `cus_`, user id), `timezone`, `page`, `perPage` (default 20, max 100). Items MUST sort by `current_period_end` ascending, then ledger id ascending. The list MUST NOT include payment-method last4, street, or postal code. The response MUST use the shared paginated envelope plus `metrics: { today, tomorrow, upcoming, overdue }` as disjoint civil counts. Metrics MUST respect `windowDays`, `account`, and `includeOverdue`, and MUST ignore `q` and `productionStatus`. Each item MUST include a compact `lineItems` array (`flavor`, `quantity`, `packSize`, `petName` when known). Mix is dense when `lineItems.length > 3` or pack sizes are mixed.

#### Scenario: Paginated list with metrics

- **WHEN** an operator requests page 1 with default filters
- **THEN** the payload includes paginated flattened items ordered by period end then id and the four metric counts

#### Scenario: Search does not shrink KPIs

- **WHEN** the caller sends `q` matching one email while three other subscriptions still vence hoje
- **THEN** the list may contain one row and `metrics.today` remains 3

#### Scenario: Metrics ignore production status filter

- **WHEN** the grid is filtered to `productionStatus=in_production` but three other subscriptions still vence hoje
- **THEN** `metrics.today` still counts those three

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

### Requirement: Missing production cycle means to prepare

The system MUST treat a subscription with no production-cycle row for the current `current_period_end` as `to_prepare`. A cycle row MUST be created only on the first successful status update for that `(subscription_id, period_end)` pair. Stored `period_end` MUST equal the ledger’s `current_period_end` at update time.

#### Scenario: First visit has no stored cycle

- **WHEN** an eligible subscription has never been patched
- **THEN** the queue shows production status `to_prepare` without a pre-created row

#### Scenario: First patch persists the cycle

- **WHEN** an operator first sets status to `in_production` with the current `periodEnd`
- **THEN** a cycle row is upserted for that period end and later reads show `in_production`

### Requirement: Operators can advance production status with a closed transition matrix

Authorized callers MUST update status via `PATCH /api/v1/admin/production/queue/:id` with `production.write`, where `:id` is the ledger id. Body MUST be `{ status, periodEnd, note? }`. `periodEnd` MUST equal the ledger `current_period_end` at apply time or the update MUST fail with 409. If the subscription is no longer queue-eligible, the update MUST fail with 409. Allowed transitions MUST be only:

| from | to_prepare | in_production | ready | blocked |
| --- | --- | --- | --- | --- |
| to_prepare | no | yes | no | yes |
| in_production | no | no | yes | yes |
| ready | no | yes | no | no |
| blocked | yes | no | no | no |

Any other edge, including `to_prepare → ready` and `ready → blocked`, MUST be rejected with 400. Transition to `blocked` MUST include `note` of 1–255 characters; other transitions MUST NOT require `note`. A successful update MUST record admin audit action `production.status.update`.

#### Scenario: Happy path to ready

- **WHEN** an operator moves `to_prepare` to `in_production` and then to `ready` with matching `periodEnd`
- **THEN** both updates succeed and the queue shows `ready`

#### Scenario: Block from in_production requires a note

- **WHEN** an operator sets `in_production` to `blocked` with a 1–255 character note
- **THEN** the item is blocked with that note

#### Scenario: Block without a note is rejected

- **WHEN** an operator sets a non-ready item to `blocked` with a missing or empty note
- **THEN** the update is rejected and the cycle is unchanged

#### Scenario: Reopen a ready cycle

- **WHEN** an operator sets a `ready` item to `in_production` with matching `periodEnd`
- **THEN** the update succeeds

#### Scenario: Stale period end

- **WHEN** the PATCH `periodEnd` does not match the ledger `current_period_end`
- **THEN** the response is 409 and no cycle is written

#### Scenario: Subscription left the queue

- **WHEN** the ledger row is `canceled`, has `cancel_at_period_end` true, or has no `current_period_end`
- **THEN** PATCH returns 409 and no cycle is written

#### Scenario: Unauthorized write

- **WHEN** a caller without `production.write` sends PATCH
- **THEN** the update is rejected and the cycle is unchanged

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
