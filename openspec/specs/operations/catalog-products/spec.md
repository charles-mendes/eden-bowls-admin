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

On product detail, **Salvar**, **Publicar**, **Desativar**, **Sincronizar Stripe**, and **Excluir produto** MUST NOT be rendered until the product GET has resolved. A session without `catalog.write` MUST NOT see save, publish, deactivate, or delete. A session without `catalog.sync` MUST NOT see **Sincronizar Stripe**. After the product has loaded, a publish of that loaded draft MUST send `active` true and MUST NOT include `variants`, plan country, code or plan days. **Desativar** is the control that unpublishes a loaded published product (`PATCH` with `active` false). **Excluir produto** MUST appear only when the loaded product has `canDelete` true.

#### Scenario: Publish is absent while the product is loading

- **WHEN** a session with `catalog.write` and `catalog.sync` opens a product detail and the product GET has not resolved
- **THEN** **Publicar**, **Desativar**, **Salvar**, **Sincronizar Stripe**, and **Excluir produto** are not on the screen and no PATCH has been sent

#### Scenario: Readonly detail has no mutations

- **WHEN** a session with only `catalog.read` opens a loaded product detail
- **THEN** save, publish, deactivate, sync, and delete controls are absent

#### Scenario: Publish uses the loaded product

- **WHEN** a session with `catalog.write` publishes a loaded draft
- **THEN** the PATCH body is `active` true
- **AND** the PATCH body does not include `variants`, `planCountry` or `planDays`

#### Scenario: Published linked product deactivates instead of deleting

- **WHEN** a session with `catalog.write` opens a loaded published product whose `canDelete` is false
- **THEN** the screen shows **Desativar** and does not show **Excluir produto**
- **AND** confirming **Desativar** asks to take the product off the store while keeping the record and current billing, then sends `PATCH` with `active` false

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

### Requirement: Variation dialog stays open when save fails

When the variation PATCH fails, the dialog MUST stay open, the fields MUST keep what the operator typed, and the error MUST be shown in the dialog.

#### Scenario: Rejected PATCH keeps the dialog

- **WHEN** a session with `catalog.write` confirms a variation edit and the PATCH is rejected
- **THEN** the dialog stays open, the edited fields are unchanged, and the error is visible in the dialog

### Requirement: Catalog sync runs are persisted per market

Every catalog price sync MUST be stored as one run per market it touched, with market (`BR`|`US`), currency, scope (`market`|`product`), product id when scoped to a product, result (`completed`, `completed_with_skips` or `failed`), created/updated/skipped counts, start and finish time. A failed sync MUST be stored with result `failed` and its error message (up to 500 characters), and the API MUST still return the original error to the caller.

#### Scenario: Successful market sync

- **WHEN** an operator syncs market `BR` and 3 prices are created
- **THEN** one `BR` run is stored with result `completed` and `created: 3`, and it survives an API restart

#### Scenario: Failed sync

- **WHEN** a `US` sync fails with the Stripe error "No such product"
- **THEN** a `US` run is stored with result `failed` and error "No such product", and the sync request still fails with that error

### Requirement: Sync runs are kept 50 per market

The system MUST keep at most the 50 most recent runs per market. Storing a new run MUST delete older runs of the same market beyond the newest 50, and MUST NOT delete runs of the other market.

#### Scenario: Fifty-first run

- **WHEN** market `BR` already has 50 runs and a new `BR` run is stored
- **THEN** the oldest `BR` run is removed, `BR` keeps 50 runs, and the `US` runs are unchanged

### Requirement: Sync status is scoped to the caller's markets

`GET /api/v1/admin/catalog/sync/status` MUST return the newest run within the caller's market scope (narrowed by `market` when given) as the top-level object, keeping the existing fields (`syncJobId`, `status`, `scope`, `market`, `currency`, `summary`, `createdAt`, `updatedAt`) plus `error`. It MUST also return `byMarket` with the newest run of each market in scope. With no run in scope it MUST return `{ status: null, byMarket: {} }`.

#### Scenario: Operator assigned to US

- **WHEN** an operator assigned only to `US` reads the status and the newest overall run is `BR`
- **THEN** the response shows the newest `US` run and `byMarket` has only `US`

#### Scenario: Admin sees both markets

- **WHEN** an admin reads the status and both markets have runs
- **THEN** `byMarket` has `BR` and `US`, each with its newest run

#### Scenario: No runs yet

- **WHEN** no sync has ever run in the caller's scope
- **THEN** the response is `{ status: null, byMarket: {} }`

### Requirement: Missing presentation blocks activation in the product page

An inactive variation of a product without a stored presentation MUST list "apresentação" among its pending items, and a refused activation with `presentation` in `missing` MUST name the missing store presentation and offer to open the "Apresentação" tab.

#### Scenario: Activation refused without presentation

- **WHEN** the API refuses an activation with `missing: ['presentation']`
- **THEN** the page says the recipe's store presentation is missing

### Requirement: Unsaved product fields are visible

**Salvar** in the "Dados gerais" tab MUST send name, aliases, short label and life stage, and MUST NOT send `variants`, plan country or code. It MUST stay available while the product is published, since these fields apply to every variation. When a field on screen differs from the loaded product, the page MUST say so and that it must be saved before leaving, and closing the browser tab MUST warn. Saving the product or reloading it MUST clear that warning, except the reload after a save in another tab, which MUST keep the typed fields and their warning.

#### Scenario: Product save omits variations

- **WHEN** a session with `catalog.write` renames a loaded product and saves
- **THEN** the PATCH body includes the name and does not include `variants`, `planCountry` or the code

#### Scenario: Changed field warns before leaving

- **WHEN** a session with `catalog.write` changes the short label of a loaded product and has not saved
- **THEN** the page says the general data is changed and must be saved before leaving

### Requirement: Operator creates a recipe product

A session with `catalog.write` MUST create a product with **Nome**, **Mercado**, **Código** and **Fase de vida**. The code MUST be filled from the name as a lowercase slug until the operator edits it, and the dialog MUST say code and market cannot change later. API refusals (`product_code_taken`, `recipe_key_invalid`) MUST appear in Portuguese inside the dialog, keeping what was typed. After creating, the panel MUST open the new product's detail.

#### Scenario: Create Receita de Cordeiro

- **WHEN** a writer types "Receita de Cordeiro" for BR with stage Adulto and saves
- **THEN** the panel sends name, `planCountry` BR, code `receita-de-cordeiro` and `lifeStage` adult, and opens the product detail

#### Scenario: Code taken

- **WHEN** the API answers 409 `product_code_taken`
- **THEN** the dialog says the market already has a product with that code and keeps the typed values

### Requirement: Code and market are read-only after creation

The product detail MUST show the code and the market as text, never as inputs, for every session.

#### Scenario: Writer opens a draft

- **WHEN** a writer opens a loaded draft product
- **THEN** code and market are shown as text and no request can change them

### Requirement: Product page groups the recipe in tabs

The product detail MUST have the tabs **Dados gerais** (name, code, market, status, aliases, short label, life stage), **Apresentação**, **Imagens** (home image and plan thumbnail), **Rótulo** and **Variações**. Each content tab MUST behave as the content sections of `operations/catalog-recipe-content` and save to the product's content routes. Changing the life stage MUST say it applies to every variation of the product.

#### Scenario: Open the label tab

- **WHEN** a writer opens **Rótulo** on the BR `beef` product
- **THEN** the tab shows the BR label of the product with its status and missing items

#### Scenario: Readonly tabs

- **WHEN** a `readonly` user opens any tab
- **THEN** the content is shown without save, upload or remove controls

### Requirement: Pending recipe items open their tab

For an inactive variation, the pending items "foto", "rótulo" and "apresentação" MUST be actions that open the **Imagens**, **Rótulo** and **Apresentação** tabs. The items "preço", "Stripe" and "NCM" MUST stay plain text.

#### Scenario: Missing presentation

- **WHEN** a writer clicks "apresentação" in the pending items of a variation
- **THEN** the **Apresentação** tab opens

#### Scenario: Missing price

- **WHEN** a variation lists "preço" as pending
- **THEN** "preço" is plain text and opens nothing

### Requirement: Leaving a content tab with unsaved changes asks first

Switching tabs or leaving the page MUST ask for confirmation when the presentation or label form holds unsaved changes, or a chosen home image or plan thumbnail was not saved. Declining MUST keep the tab and the typed values.

#### Scenario: Unsaved label

- **WHEN** a writer types an ingredient in **Rótulo** and clicks **Variações**
- **THEN** the page asks to discard the changes, and declining keeps **Rótulo** open with the ingredient

#### Scenario: Nothing changed

- **WHEN** a writer opens **Rótulo** and switches tab without editing
- **THEN** the tab changes without asking

### Requirement: Variation dialog saves one pack

**Editar** MUST open a dialog filled with that variation's SKU, name, weight, price, NCM, origin and readiness confirmations, and show the product's flavor, code and life stage as text. **Adicionar variação** MUST open the same dialog empty. Confirming MUST send `PATCH` with `variants` containing only that item (with its id when it exists) and MUST NOT send `recipeKey`, flavor, slug, aliases, life stage, short label or plan country. A new variation MUST be rejected in the dialog when both name and SKU are empty, without a request. A 422 `variation_weight_taken` MUST appear in the dialog. Cancel MUST close the dialog without a request. After a successful save the dialog MUST close and the table MUST show the saved variation.

#### Scenario: Edit sends one existing variation

- **WHEN** a session with `catalog.write` edits the price of a saved variation on a draft and confirms the dialog
- **THEN** the PATCH body is `variants` with that single variation, its id and the new price, and no flavor or recipe field

#### Scenario: Weight already on the product

- **WHEN** the API refuses a new 300 g variation with 422 `variation_weight_taken`
- **THEN** the dialog stays open with the typed fields and says the product already has a 300 g variation

#### Scenario: Cancel discards the dialog

- **WHEN** a session with `catalog.write` opens **Editar** and cancels
- **THEN** no PATCH is sent and the table still shows the variation as it was loaded

### Requirement: Active variation without weight asks for it

When an active variation has no weight, the product page MUST show, above the publication section, a warning "Fora do estoque:" naming the variation (or how many) and, for `catalog.write`, an **Informar peso** button. Its row MUST show the badge "Sem peso" in the Peso column and, for `catalog.write`, an **Informar peso** action, even when the variation is locked by the published product. **Informar peso** MUST open a dialog with only the Peso field and MUST send `PATCH` with `variants: [{ id, weight }]`. An empty weight MUST NOT be sent. After saving, the warning MUST give place to "Peso salvo. … já aparece no Estoque." and, when the page was opened with `?variation=:id&campo=peso`, a **Voltar ao Estoque** link. Opening the page with `?variation=:id&campo=peso` on a variation without weight MUST open that dialog on the Variações tab.

#### Scenario: Fill the weight from the stock link

- **WHEN** an operator opens `/catalog/products/2038?variation=2015&campo=peso` and variation `2015` is active without weight
- **THEN** the Variações tab opens with the Informar peso dialog, saving `300g` sends `{ variants: [{ id: '2015', weight: '300g' }] }`, and the page shows **Voltar ao Estoque**

### Requirement: Product list shows the recipe state

The product list MUST show, for each product, its code, life stage, active and total variations, whether it has a home image and its label status. It MUST offer the quick filters **Sem imagem** and **Rótulo incompleto**, the latter also matching products without a label.

#### Scenario: Products of BR

- **WHEN** a readonly session opens Produtos with BR `beef` (2 of 2 variations active, with image) and `senior-lamb` (draft, no variations, no image)
- **THEN** the list shows both with their codes, "2/2" and "0/0" variations, and the image and label states

#### Scenario: Quick filter

- **WHEN** an operator turns on **Sem imagem**
- **THEN** only `senior-lamb` stays on the list

### Requirement: Old recipe links open the product

Opening `/catalog/recipes/:market/:recipeKey` MUST look up the product of that market and code and redirect to its detail, keeping a section anchor. Opening `/catalog/recipes` MUST redirect to Produtos. An unknown code MUST say the recipe no longer exists and link to Produtos.

#### Scenario: Bookmark of a recipe page

- **WHEN** an operator opens `/catalog/recipes/BR/beef#rotulo`
- **THEN** the panel opens the BR `beef` product on the **Rótulo** tab
