# Spec Delta

## ADDED Requirements

### Requirement: Stripe PDF names the subscription's account

"PDF Stripe" MUST request the invoice PDF with the subscription's Stripe account as `account`, so a session with both markets opens the PDF instead of getting `404`.

#### Scenario: Admin with both markets

- **WHEN** an admin with BR and US clicks "PDF Stripe" on an invoice of a `br` subscription
- **THEN** the panel requests `/api/v1/admin/billing/invoices/<invoice>/pdf?account=br` and opens the returned URL
