# Design

## Context

See proposal.md for motivation. Specs: `operations/onboarding-checkouts` (new) and `operations/production-queue` (term subline).

Today the list formats Prazo as `` `${termMonths}m` `` and Recorrência via `formatFrequency`. The 360 plan grid already uses `formatTermMonths` and still shows Recorrência. Production queue uses `{item.termMonths}m` when the number is present. CSV `toCsv` headers are `userId` … `firstInvoiceTotal`; `frequency` is translated (Mensal/…). Export already downloads with `response.blob()`, not `response.text()`.

`recurrence.frequency` is a store alias of the plan term. Checkout completeness only checks that the recurrence **object** is non-empty. Freight, Stripe billing, and the production queue do not read the field.

OpenSpec for this change lives in the admin repo (same pattern as production-queue). CSV work is in `eden-bowls-backend`.

## Goals / Non-Goals

**Goals:**

- One operator-facing wording for the store term across list, 360, production queue, and CSV `termLabel`.
- Keep the CSV positional contract for existing columns; add the readable label at the end.
- Keep `recurrence` in persistence and JSON; stop presenting it as Recorrência in operational UI.

**Non-Goals:**

- Deriving Prazo from N Stripe subscriptions (Misto divergence).
- UTF-8 BOM / Excel encoding for the whole CSV.
- Sharing one formatter package across admin TS and backend JS.
- Changing coupons slot ids (`1m`).

## Decisions

### 1. Reuse `formatTermMonths` in the admin; duplicate the label rule in CSV

Admin already has `formatTermMonths`: null/invalid → `-`; 1 → `1 mês`; else → `<n> meses` (via `formatNumber`). List and production queue MUST call it. CSV cannot import that module; add `formatCsvTermLabel` next to `formatCsvFrequency`. Same numeric cases (`null`, `1`, `3`, `6`, `12`) on both sides. CSV null → `''` (empty cell), not `-`.

Alternative considered: one shared package. Rejected — two repos, no existing shared UI lib, overkill for one function.

### 2. Append `termLabel`; do not drop or stringify existing CSV columns

Header becomes:

`userId,email,displayName,updatedAt,stripeStatus,stripeSubscriptionId,frequency,termMonths,firstInvoiceTotal,termLabel`

`frequency` stays as **legacy** (comment on the header array): Mensal/Quinzenal/Semanal still go out so saved workbooks keep working. Prefer `termLabel` for new use. Tests MUST assert the header array, not only `toContain('Mensal')`.

Alternative considered: remove `frequency` or write `termMonths` as “1 mês”. Rejected — breaks filters, sorts, and column-index consumers.

### 3. No BOM in this change

Mojibake already exists for names/addresses. BOM would change the first bytes (`utf-8-sig`) for every consumer. Download already uses `blob()`, so a later BOM on the **route** `handle()` (`result.csv` branch in `admin.routes.js`) would survive the browser. Do **not** prefix in `toCsv` / the service (Jest compares the CSV start). Follow-up, not this change.

Alternative considered: add BOM now because `mês` is non-ASCII. Rejected — encoding is a CSV-wide concern, not a `termLabel` side effect.

### 4. Header **Prazo (plano escolhido)**; 360 JSON title **Payload recurrence**

“Plan” is a store step name. The list header MUST say the value comes from the chosen plan, not the Stripe ledger. 360 keeps a technical dump so operators can still inspect the stored object.

Alternative considered: **Prazo (Plan)**. Rejected — opaque to operators.

### 5. Production queue still hides the subline when term is absent

`formatTermMonths(null)` is `-`. Specs require omitting the subline when there is no positive term, matching today’s `item.termMonths ? … : null`. Only swap the text when the number is present.

## Risks / Trade-offs

- [CSV still ships Mensal/Quinzenal/Semanal] → Document `frequency` as legado in code; `termLabel` is the supported label. Removing `frequency` later is a separate breaking change.
- [Two formatters drift] → Same cases including `12` in Vitest and Jest.
- [Misto still shows plan_selection term] → Header wording is the palliative; ledger aggregation is follow-up.
- [Apply is admin-rooted] → CSV edits are in `eden-bowls-backend`; implement that service in the same apply pass.

## Migration Plan

- Deploy backend first or together: additive `termLabel` is ignored by old admin.
- Rollback: revert `toCsv` (drop last column) and admin UI. No data migration.
- List Vitest currently asserts `A cada 4 semanas` from the Recorrência fixture (`every_4_weeks`); that assertion MUST be replaced.

## Open Questions

None. BOM, column position, header copy, and formatter parity are decided above.
