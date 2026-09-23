# Spec Delta

## MODIFIED Requirements

### Requirement: Detail mutations wait until the product loads

On product detail, **Salvar**, **Publicar**, **Voltar para rascunho**, **Sincronizar Stripe**, and **Excluir produto** MUST NOT be rendered until the product GET has resolved. A session without `catalog.write` MUST NOT see save, publish, or delete. A session without `catalog.sync` MUST NOT see **Sincronizar Stripe**. After the product has loaded, a publish of that loaded draft MUST send that product’s plan country, plan days, and `active` true, and MUST NOT include `variants`. **Salvar** MUST stay disabled while the loaded product is published.

#### Scenario: Publish is absent while the product is loading

- **WHEN** a session with `catalog.write` and `catalog.sync` opens a product detail and the product GET has not resolved
- **THEN** **Publicar**, **Salvar**, **Sincronizar Stripe**, and **Excluir produto** are not on the screen and no PATCH has been sent

#### Scenario: Readonly detail has no mutations

- **WHEN** a session with only `catalog.read` opens a loaded product detail
- **THEN** save, publish, sync, and delete controls are absent

#### Scenario: Publish uses the loaded product

- **WHEN** a session with `catalog.write` publishes a loaded draft
- **THEN** the PATCH body includes that product’s plan country, plan days, and `active` true
- **AND** the PATCH body does not include `variants`

## ADDED Requirements

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
