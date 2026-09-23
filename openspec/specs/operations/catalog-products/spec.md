# operations/catalog-products Specification

## Purpose

Lets catalog staff open a product from the list without guessing that the blue name is a link, and edit that product only after its record has loaded.

## Requirements

### Requirement: Product list offers an explicit detail action

The catalog product list MUST show an actions column for every session that can open the list. Each row MUST include a **Detalhes** control that navigates to `/catalog/products/:id` for that product. The product name MUST remain a link to the same detail. **Excluir** MUST appear only for a session with `catalog.write` when that product’s `canDelete` is true, and MUST keep asking for confirmation before delete. When the session has `catalog.write`, `canDelete` is false, and the product is published, the row MUST show **Desativar** and MUST NOT show **Excluir**. When the session has `catalog.write`, `canDelete` is false, and the product is a draft, the row MUST NOT show **Excluir** or **Desativar**, and MUST say that the product is linked to a subscription and cannot be deleted.

#### Scenario: Reader sees Detalhes and not Excluir

- **WHEN** a session with `catalog.read` and without `catalog.write` opens `/catalog/products` and the list has a product
- **THEN** the row shows **Detalhes** to that product’s detail and does not show **Excluir** or **Desativar**

#### Scenario: Writer sees Detalhes beside Excluir

- **WHEN** a session with `catalog.write` opens `/catalog/products` and a product has `canDelete` true
- **THEN** the row shows **Detalhes** and **Excluir** for that product

#### Scenario: Linked published product offers Desativar

- **WHEN** a session with `catalog.write` opens `/catalog/products` and a published product has `canDelete` false
- **THEN** the row shows **Desativar** and does not show **Excluir**
- **AND** confirming **Desativar** sends `PATCH` with `active` false and does not send `DELETE`

#### Scenario: Linked draft product has no destructive action

- **WHEN** a session with `catalog.write` opens `/catalog/products` and a draft product has `canDelete` false
- **THEN** the row does not show **Excluir** or **Desativar** and says the product is linked to a subscription and cannot be deleted

### Requirement: Published state uses one label

The list and the product detail MUST describe the same `active` flag, which is true only when the product status is `publish`. Both screens MUST show **Publicado** when it is true and **Rascunho** when it is false. The list MUST NOT label that column **Ativo** or show **Sim** / **Não** for it.

#### Scenario: Published product

- **WHEN** a product with `active` true appears on the list and on its detail
- **THEN** both screens show **Publicado**

#### Scenario: Draft product

- **WHEN** a product with `active` false appears on the list and on its detail
- **THEN** both screens show **Rascunho**

### Requirement: Detail mutations wait until the product loads

On product detail, **Salvar**, **Publicar**, **Desativar**, **Sincronizar Stripe**, and **Excluir produto** MUST NOT be rendered until the product GET has resolved. A session without `catalog.write` MUST NOT see save, publish, deactivate, or delete. A session without `catalog.sync` MUST NOT see **Sincronizar Stripe**. After the product has loaded, a publish of that loaded draft MUST send that product’s plan country, plan days, and `active` true, and MUST NOT include `variants`. **Salvar** MUST stay disabled while the loaded product is published. **Desativar** is the control that unpublishes a loaded published product (`PATCH` with `active` false). **Excluir produto** MUST appear only when the loaded product has `canDelete` true.

#### Scenario: Publish is absent while the product is loading

- **WHEN** a session with `catalog.write` and `catalog.sync` opens a product detail and the product GET has not resolved
- **THEN** **Publicar**, **Desativar**, **Salvar**, **Sincronizar Stripe**, and **Excluir produto** are not on the screen and no PATCH has been sent

#### Scenario: Readonly detail has no mutations

- **WHEN** a session with only `catalog.read` opens a loaded product detail
- **THEN** save, publish, deactivate, sync, and delete controls are absent

#### Scenario: Publish uses the loaded product

- **WHEN** a session with `catalog.write` publishes a loaded draft
- **THEN** the PATCH body includes that product’s plan country, plan days, and `active` true
- **AND** the PATCH body does not include `variants`

#### Scenario: Published linked product deactivates instead of deleting

- **WHEN** a session with `catalog.write` opens a loaded published product whose `canDelete` is false
- **THEN** the screen shows **Desativar** and does not show **Excluir produto**
- **AND** confirming **Desativar** asks to take the product off the store while keeping the record and current billing, then sends `PATCH` with `active` false

### Requirement: Missing plan days stay empty

When the loaded product has no positive `planDays`, the duration field MUST be empty. The panel MUST NOT display or submit `28` as a stand-in. A product that already has plan days MUST keep showing and submitting that value.

#### Scenario: Null plan days

- **WHEN** product detail loads a product whose `planDays` is null
- **THEN** the duration field is empty and saving does not send `28`

#### Scenario: Existing plan days

- **WHEN** product detail loads a product whose `planDays` is `28`
- **THEN** the duration field shows `28` and a save sends `28`

### Requirement: Variation sync status is readable

The variation table MUST show sync status in Portuguese: **Sincronizado** for `synced`, **Não sincronizado** for `not_synced`, and **Preço divergente** for `price_mismatch`. When the variation still needs sync, the cell MUST also say that it needs sync. A blocked publish MUST name the variation by name or SKU, not by raw id. The sync result MUST state how many prices were created and how many were updated, in Portuguese.

#### Scenario: Synced variation

- **WHEN** a loaded variation has sync status `synced` and does not require sync
- **THEN** the status cell shows **Sincronizado** and does not show the raw code `synced`

#### Scenario: Blocked publish names the variation

- **WHEN** publish is blocked because a variation has no Stripe price
- **THEN** the alert identifies that variation by name or SKU

### Requirement: Stale delete refreshes the product actions

When delete returns HTTP 409 with `product_in_use` or `variation_in_use`, the panel MUST tell the operator the product is already on a subscription and cannot be deleted, and MUST reload the list or the detail so the actions match the new `canDelete`. A failed Stripe archive (HTTP 502) MUST leave the product on screen.

#### Scenario: Delete conflicts after the page was opened

- **WHEN** a session with `catalog.write` confirms **Excluir** and the delete responds 409 `product_in_use`
- **THEN** the panel shows that the product is on a subscription and cannot be deleted, and requests the list or detail again

#### Scenario: Stripe archive failure keeps the row

- **WHEN** delete responds 502 because the Stripe archive failed
- **THEN** the product remains on the list or detail and the panel shows the failure

### Requirement: A linked variation cannot be deleted on its own

On a loaded product detail, **Excluir** for a variation MUST appear only when that variation’s `canDelete` is true. A variation with `canDelete` false MUST NOT offer **Excluir** or **Desativar**, and MUST say it is in use on a subscription. Another variation on the same product with `canDelete` true MUST still offer **Excluir**.

#### Scenario: One linked variation blocks only itself

- **WHEN** a loaded product has one variation with `canDelete` false and another with `canDelete` true
- **THEN** only the unlinked variation shows **Excluir**, and the linked variation says it is in use on a subscription

### Requirement: Draft variation row offers Editar beside Excluir

On a loaded product detail, each saved variation MUST be shown as text, not as an inline form. When the session has `catalog.write` and the product is a draft, the row MUST show **Editar** beside **Excluir**. When the product is published, the row MUST NOT show **Editar** or **Adicionar variação**. A session without `catalog.write` MUST NOT see **Editar** or **Adicionar variação**.

#### Scenario: Draft writer sees Editar beside Excluir

- **WHEN** a session with `catalog.write` opens a loaded draft that has a saved variation
- **THEN** that row shows **Editar** and **Excluir**, and the SKU, name, and price are text

#### Scenario: Published product has no variation edit

- **WHEN** a session with `catalog.write` opens a loaded published product that has a saved variation
- **THEN** that row does not show **Editar** and the page does not show **Adicionar variação**

#### Scenario: Readonly detail has no Editar

- **WHEN** a session with only `catalog.read` opens a loaded product detail that has a saved variation
- **THEN** the row does not show **Editar**

### Requirement: Variation dialog saves one variation

**Editar** MUST open a dialog filled with that variation’s SKU, name, flavor, slug, aliases, and price. **Adicionar variação** MUST open the same dialog empty. Confirming an existing variation MUST send `PATCH` with `variants` containing only that item, including its id, and MUST omit `planCountry` and `planDays`. Confirming a new variation MUST send `PATCH` with `variants` containing only that item and without an id, and MUST omit `planCountry` and `planDays`. A new variation MUST be rejected in the dialog when both name and SKU are empty, without a request. Cancel MUST close the dialog without a request. After a successful save the dialog MUST close and the table MUST show the saved variation. The slug field MUST stay locked when the variation already has an id and a slug.

#### Scenario: Edit sends one existing variation

- **WHEN** a session with `catalog.write` edits the price of a saved variation on a draft and confirms the dialog
- **THEN** the PATCH body is `variants` with that single variation, including its id and the new price
- **AND** the body does not include `planCountry` or `planDays`

#### Scenario: Add sends one variation without an id

- **WHEN** a session with `catalog.write` adds a variation with a name or SKU and confirms the dialog
- **THEN** the PATCH body is `variants` with that single variation and without an id

#### Scenario: Empty new variation does not send a request

- **WHEN** a session with `catalog.write` confirms a new variation that has neither name nor SKU
- **THEN** no PATCH is sent and the dialog stays open

#### Scenario: Cancel discards the dialog

- **WHEN** a session with `catalog.write` opens **Editar** and cancels
- **THEN** no PATCH is sent and the table still shows the variation as it was loaded

### Requirement: Variation dialog stays open when save fails

When the variation PATCH fails, the dialog MUST stay open, the fields MUST keep what the operator typed, and the error MUST be shown in the dialog.

#### Scenario: Rejected PATCH keeps the dialog

- **WHEN** a session with `catalog.write` confirms a variation edit and the PATCH is rejected
- **THEN** the dialog stays open, the edited fields are unchanged, and the error is visible in the dialog

### Requirement: Unsaved plan fields are visible

**Salvar** on product detail MUST send plan country and plan days and MUST NOT send `variants`. When the country or duration on screen differs from the loaded product, the page MUST say that country and duration are changed and must be saved before leaving, and closing the browser tab MUST warn. Saving the product or reloading it MUST clear that warning.

#### Scenario: Product save omits variations

- **WHEN** a session with `catalog.write` saves plan country and plan days on a loaded draft
- **THEN** the PATCH body includes plan country and plan days and does not include `variants`

#### Scenario: Changed duration warns before leaving

- **WHEN** a session with `catalog.write` changes the duration of a loaded draft and has not saved
- **THEN** the page says country and duration are changed and must be saved before leaving
