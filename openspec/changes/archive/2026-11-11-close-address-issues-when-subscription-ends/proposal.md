# Proposal

## Why

The backend change `close-address-issues-when-subscription-ends` closes an address problem with `resolved_by: ended` when its subscription ends with no box left to ship. The panel has its own text only for `customer`, and every other resolved state reads "Substituído em dd/mm". The new `ended` would read as superseded. A problem an operator closed by filling the recipient (`operator`) already reads as superseded today, which is wrong.

## What Changes

- A resolved problem shows its own text for each `resolved_by`:
  - `customer`: "Cliente corrigiu em dd/mm" (success), as today.
  - `operator`: "Operador corrigiu em dd/mm" (success).
  - `ended`: "Assinatura encerrada em dd/mm" (muted).
  - `superseded` and any unknown value: "Substituído em dd/mm" (muted), as today.
- The text shows wherever the problem state shows today: Entregas Brasil rows, Etiquetas UPS rows, the subscription detail and the NF-e detail.
- Today's "N problemas de endereço abertos" item and its link do not change.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `operations/courier-deliveries`: "A row shows the address problem and the email" lists the resolved texts.
- `operations/subscription-detail`: "The detail shows the address problem" gains scenarios for a problem closed by an operator and for one closed because the subscription ended.

## Impact

- `src/lib/addressIssues.ts` (`addressIssueState`, the `resolved_by` type) and `src/lib/addressIssues.test.ts`.
- No new route, so `contracts/backend-routes.json` does not change.
- Paired with `eden-bowls-backend/openspec/changes/close-address-issues-when-subscription-ends` (`delivery-address-issues`). Both are applied and archived together. The panel can ship before the backend, because until then `ended` never arrives.
