# Spec Delta

## MODIFIED Requirements

### Requirement: Queue items expose kitchen-ready pack and flavor mix

Each queue item MUST support these grid columns, in order: Vencimento (datetime + due badge); Cliente (ledger snapshot: email, plus name from the row address when present — not a live WordPress `displayName`); Pets + mix de sabores × quantidade; Packs (sum of quantities) + tamanho (`500 g` or “misto”); Plano (`plan_label` + term); País / cidade; Pagamento (Stripe status); Produção (badge); Ações (status advance when permitted; link Assinante / Cliente and link Onboarding 360 only when `customerProfileInScope` is true). When `customerProfileInScope` is false, Cliente identity MUST remain visible as text without those links. Plan subtotal MUST appear only when `catalog_pricing.subtotal` exists. Packs and flavors MUST come from `plan_selection.catalog_pricing.line_items` when present, else `pets[].selected_flavors` / `flavor_weights`. When a positive term in months is present, the Plano term subline MUST use the same spelled-out form as Onboarding 360 checkouts (`1 mês` or `<n> meses`) and MUST NOT use compact `Nm`. When the term is missing, the subline MUST be omitted.

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

#### Scenario: Plan term is spelled out

- **WHEN** a queue item has `plan_label` and term months 1
- **THEN** the Plano column shows the plan label and **1 mês**, not `1m`

#### Scenario: Missing plan term hides the subline

- **WHEN** a queue item has a plan label and no positive term months
- **THEN** the Plano column does not show a term subline
