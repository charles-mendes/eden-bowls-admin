## MODIFIED Requirements

### Requirement: Detail mutations wait until the product loads

On product detail, **Salvar**, **Publicar**, **Desativar**, **Sincronizar Stripe**, and **Excluir produto** MUST NOT be rendered until the product GET has resolved. A session without `catalog.write` MUST NOT see save, publish, deactivate, or delete. A session without `catalog.sync` MUST NOT see **Sincronizar Stripe**. After the product has loaded, a publish of that loaded draft MUST send that product's plan country and `active` true, and MUST NOT include `variants` or plan days. **Salvar** MUST stay disabled while the loaded product is published. **Desativar** is the control that unpublishes a loaded published product (`PATCH` with `active` false). **Excluir produto** MUST appear only when the loaded product has `canDelete` true.

#### Scenario: Publish is absent while the product is loading

- **WHEN** a session with `catalog.write` and `catalog.sync` opens a product detail and the product GET has not resolved
- **THEN** **Publicar**, **Desativar**, **Salvar**, **Sincronizar Stripe**, and **Excluir produto** are not on the screen and no PATCH has been sent

#### Scenario: Readonly detail has no mutations

- **WHEN** a session with only `catalog.read` opens a loaded product detail
- **THEN** save, publish, deactivate, sync, and delete controls are absent

#### Scenario: Publish uses the loaded product

- **WHEN** a session with `catalog.write` publishes a loaded draft
- **THEN** the PATCH body includes that product's plan country and `active` true
- **AND** the PATCH body does not include `variants` or `planDays`

#### Scenario: Published linked product deactivates instead of deleting

- **WHEN** a session with `catalog.write` opens a loaded published product whose `canDelete` is false
- **THEN** the screen shows **Desativar** and does not show **Excluir produto**
- **AND** confirming **Desativar** asks to take the product off the store while keeping the record and current billing, then sends `PATCH` with `active` false

## ADDED Requirements

### Requirement: Unsaved product fields are visible

**Salvar** on product detail MUST send the plan country and MUST NOT send `variants`, plan days or large-pack limit. When the country on screen differs from the loaded product, the page MUST say so and that it must be saved before leaving, and closing the browser tab MUST warn. Saving the product or reloading it MUST clear that warning, except the reload after a save in the recipe side panel, which MUST keep the typed country and its warning.

#### Scenario: Product save omits variations

- **WHEN** a session with `catalog.write` saves the plan country on a loaded draft
- **THEN** the PATCH body includes the plan country and does not include `variants` or `planDays`

#### Scenario: Changed field warns before leaving

- **WHEN** a session with `catalog.write` changes the country of a loaded draft and has not saved
- **THEN** the page says the country is changed and must be saved before leaving

## REMOVED Requirements

### Requirement: Missing plan days stay empty

**Reason**: Plan days leave the product; they are edited on the Plano screen (`operations/catalog-plan-settings`).
**Migration**: None in the product page.

### Requirement: Unsaved plan fields are visible

**Reason**: Duration and large-pack limit leave the product page; replaced by "Unsaved product fields are visible", which covers the plan country only.
**Migration**: None.

### Requirement: Plan section edits the large-pack limit

**Reason**: The large-pack limit is a market setting, saved with `PUT /api/v1/admin/catalog/plan-settings`.
**Migration**: Use the Plano screen (`operations/catalog-plan-settings`).
