# Spec Delta

## Purpose

Lets catalog staff open a product from the list without guessing that the blue name is a link, and edit that product only after its record has loaded.

## ADDED Requirements

### Requirement: Product list offers an explicit detail action

The catalog product list MUST show an actions column for every session that can open the list. Each row MUST include a **Detalhes** control that navigates to `/catalog/products/:id` for that product. The product name MUST remain a link to the same detail. **Excluir** MUST appear only for a session with `catalog.write`, and MUST keep asking for confirmation before delete.

#### Scenario: Reader sees Detalhes and not Excluir

- **WHEN** a session with `catalog.read` and without `catalog.write` opens `/catalog/products` and the list has a product
- **THEN** the row shows **Detalhes** to that product’s detail and does not show **Excluir**

#### Scenario: Writer sees Detalhes beside Excluir

- **WHEN** a session with `catalog.write` opens `/catalog/products` and the list has a product
- **THEN** the row shows **Detalhes** and **Excluir** for that product

### Requirement: Published state uses one label

The list and the product detail MUST describe the same `active` flag, which is true only when the product status is `publish`. Both screens MUST show **Publicado** when it is true and **Rascunho** when it is false. The list MUST NOT label that column **Ativo** or show **Sim** / **Não** for it.

#### Scenario: Published product

- **WHEN** a product with `active` true appears on the list and on its detail
- **THEN** both screens show **Publicado**

#### Scenario: Draft product

- **WHEN** a product with `active` false appears on the list and on its detail
- **THEN** both screens show **Rascunho**

### Requirement: Detail mutations wait until the product loads

On product detail, **Salvar**, **Publicar**, **Voltar para rascunho**, **Sincronizar Stripe**, and **Excluir produto** MUST NOT be rendered until the product GET has resolved. A session without `catalog.write` MUST NOT see save, publish, or delete. A session without `catalog.sync` MUST NOT see **Sincronizar Stripe**. After the product has loaded, a publish of that loaded record MUST send the loaded plan and variations, not an empty draft. **Salvar** MUST stay disabled while the loaded product is published.

#### Scenario: Publish is absent while the product is loading

- **WHEN** a session with `catalog.write` and `catalog.sync` opens a product detail and the product GET has not resolved
- **THEN** **Publicar**, **Salvar**, **Sincronizar Stripe**, and **Excluir produto** are not on the screen and no PATCH has been sent

#### Scenario: Readonly detail has no mutations

- **WHEN** a session with only `catalog.read` opens a loaded product detail
- **THEN** save, publish, sync, and delete controls are absent

#### Scenario: Publish uses the loaded product

- **WHEN** a session with `catalog.write` publishes a loaded draft
- **THEN** the PATCH body includes that product’s plan country, plan days, and variations, plus `active` true

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
