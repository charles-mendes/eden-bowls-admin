## MODIFIED Requirements

### Requirement: Ready row points to fulfillment

A `ready` row MUST replace "Concluído" with "Expedir". When the item's `stripeAccount` is `br` and its `country` is `BR`, it MUST link to `/operations/courier?fatura={paidInvoiceId}&assinatura={id}` using that item's `paidInvoiceId` and its subscription `id`. When the item's `deliveryDate` is after tomorrow (civil days in `America/Sao_Paulo`), the link MUST also carry `de={today}&ate={deliveryDate}`, so Entregas Brasil loads a range that holds that order; when `deliveryDate` is tomorrow or earlier, or absent, the link MUST NOT carry `de` or `ate`. When the item has no `paidInvoiceId`, it MUST link to `/operations/courier` with no query. When the `stripeAccount` is `us` and the `country` is `US`, it MUST link to `/operations/labels`. Otherwise it MUST show "Mercado divergente" without a link. The top of the queue MUST link to the fulfillment screens of the session's markets.

#### Scenario: Brazilian ready order

- **WHEN** a ready row has `id` 42, `stripeAccount: "br"`, `country: "BR"` and `paidInvoiceId: "in_123"`
- **THEN** it shows "Expedir" linking to `/operations/courier?fatura=in_123&assinatura=42`

#### Scenario: US ready order

- **WHEN** a ready row has `stripeAccount: "us"` and `country: "US"`
- **THEN** it shows "Expedir" linking to `/operations/labels`

#### Scenario: Account and address in different countries

- **WHEN** a ready row has `stripeAccount: "us"` and `country: "BR"`
- **THEN** it shows "Mercado divergente" and no fulfillment link

#### Scenario: Ready ahead of the delivery day

- **WHEN** on 2026-11-08 a ready Brazil row has `id` 42, `paidInvoiceId: "in_123"` and `deliveryDate: "2026-11-11"`
- **THEN** "Expedir" links to `/operations/courier?fatura=in_123&assinatura=42&de=2026-11-08&ate=2026-11-11`

#### Scenario: No delivery date

- **WHEN** a ready Brazil row has `id` 42, `paidInvoiceId: "in_123"` and no `deliveryDate`
- **THEN** "Expedir" links to `/operations/courier?fatura=in_123&assinatura=42` with no range

#### Scenario: No paid invoice on the item

- **WHEN** a ready Brazil row has no `paidInvoiceId`, as with an API that does not send it yet
- **THEN** "Expedir" links to `/operations/courier`
