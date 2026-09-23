# Design

## Context

See proposal.md for why. Variation rows on product detail are inputs, and the product **Salvar** PATCHes plan country, plan days, and every variation together. `patchProduct` already writes country only when `planCountry` is truthy and days only when `planDays != null`. `saveVariants` upserts the items in the array and does not delete the ones left out. The store never calls the admin catalog routes. Public catalog reads only published posts.

The panel already has `Dialog` (staff access), `.table-actions`, `ghost-button`, and `danger-button`. This screen stays on that system: one grotesk, neutral grays, one accent for the primary action, danger only for delete.

## Goals / Non-Goals

**Goals:**

- Make **Editar** the way to change one variation, next to **Excluir**.
- Persist that variation with a body the current PATCH already accepts, without writing plan country or plan days.
- Keep plan-field edits on the product **Salvar**, with a visible unsaved warning.
- Lock the partial-PATCH contract with a backend test. No service change.

**Non-Goals:**

- A new variation route, a Stripe sync scoped to one variation, or any store screen.
- Batch editing of several variations in one save.
- Changing when **Excluir** appears. The open change `catalog-product-delete-guard` owns that. This change only adds **Editar** beside it on a draft.

## Decisions

1. **The table is read-only text; the dialog is the editor.** Rows stay scannable (SKU, name, flavor, slug, aliases, price, Stripe ids, status). **Editar** is a `ghost-button` and **Excluir** stays a `danger-button`, inside `.table-actions`. Alternative: keep inline inputs and add a button that focuses the row. Rejected because that button would not be a separate action, which is what the QA could not find.

2. **One variation per confirm, on purpose.** Confirm sends `{ variants: [item] }` only. An existing row includes `id`. A new row omits `id`. Country and days stay out of that body, including empty string and null, so the conditional writes in `patchProduct` do not run. Alternative: keep sending the whole variant list from the dialog. Rejected because it would rewrite rows the operator was not editing.

3. **Product Salvar and Publicar stop sending `variants`.** Variation prices are already stored when the dialog succeeds. Publicar still sends the plan fields on screen plus `active: true`, so an unsaved country or duration is not dropped at publish. The server still syncs Stripe on publish.

4. **Failure stays in the dialog.** Network errors and 422 leave the dialog open and show the message there. Stripe sync errors do not: after `saveVariants`, `patchProduct` swallows sync failures the same way product save already does. The dialog only handles errors the PATCH returns.

5. **Unsaved plan fields use the existing muted line plus `beforeunload`.** The sentence is "País e duração alterados. Salve antes de sair." It shows when country or duration differs from the loaded product. No new banner component. Cancel on the variation dialog does not touch that warning.

6. **The backend test lives in this change, not a sister change.** Runtime behavior does not change, so there is no backend capability to modify. The Jest case is the lock that country and days meta are not written and only the sent variation id is updated.

## Risks / Trade-offs

- [Editing five variations is five dialogs and five product-wide Stripe syncs] → Accepted. Each sync lists every priced variation; an unchanged price hits `prices.list` by lookup key and does not create a new price. No app rate limit. Catalogs here are a handful of flavors and weights.
- [Operator changes country, then leaves, and only the variation was saved] → The muted warning and `beforeunload` cover the tab close. In-app navigation still relies on the warning being seen.
- [`catalog-product-delete-guard` still specifies a publish body that includes `variants`] → When both land, publish MUST omit `variants`. Do not copy that sentence back from the other delta.
- [A hand-built PATCH can still send country and days together with variants] → Unchanged. This change only stops the panel from doing it on a variation save.

## Migration Plan

Deploy the admin build. The backend test can ship with or before the panel; it does not change the API. Rollback is the previous admin build. No data migration.

## Open Questions

None.
