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

**Editar** MUST open a dialog filled with that variation’s SKU, name, flavor, slug, aliases, and price. **Adicionar variação** MUST open the same dialog empty. Confirming an existing variation MUST send `PATCH` with `variants` containing only that item, including its id, and MUST omit `planCountry` and `planDays`. Confirming a new variation MUST send `PATCH` with `variants` containing only that item and without an id, and MUST omit `planCountry` and `planDays`. A new variation MUST be rejected in the dialog when both name and SKU are empty, without a request. Cancel MUST close the dialog without a product `PATCH` and without deleting a recipe created from the dialog; a recipe `POST` already confirmed in the dialog stays. After a successful save the dialog MUST close and the table MUST show the saved variation. The slug field MUST stay locked when the variation already has an id and a slug.

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

#### Scenario: Cancel after creating a recipe

- **WHEN** a writer creates the recipe `turkey` in the dialog and then cancels the dialog
- **THEN** no product PATCH and no recipe DELETE are sent, and the recipe `turkey` remains in the market recipe list with 0 variations

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

An inactive variation whose recipe has no stored presentation (`recipePresentationReady: false`) MUST list "apresentação" among its pending items, and a refused activation with `presentation` in `missing` MUST name the missing store presentation.

#### Scenario: Activation refused without presentation

- **WHEN** the API refuses an activation with `missing: ['presentation']`
- **THEN** the page says the recipe's store presentation is missing

### Requirement: Variation dialog offers to create the missing recipe

The field "Receita (conteúdo)" MUST offer "Criar receita <chave>" when the candidate key is not a recipe of the market saved on the product. The candidate is the recipe key recorded on the variation when it is no longer registered, otherwise the flavor slug, otherwise the key derived from the flavor. The offer MUST NOT appear when the candidate is empty or registered, or when a registered recipe is selected.

#### Scenario: Registered recipe selected

- **WHEN** a writer selects `beef` for a variation whose flavor slug is `pato`
- **THEN** there is no offer to create a recipe

#### Scenario: New flavor without a recipe

- **WHEN** a writer types the flavor "Turkey" in a new variation of a BR product and the BR market has no recipe `turkey`
- **THEN** the field "Receita (conteúdo)" stays on "Sem receita" and offers "Criar receita turkey"

#### Scenario: Flavor with a registered recipe

- **WHEN** the suggested key is `beef` and the BR market has the recipe `beef`
- **THEN** the field selects `beef` and there is no offer to create a recipe

#### Scenario: Existing variation without a recipe

- **WHEN** a writer edits a saved variation with flavor slug `lamb`, no recipe linked and no recipe `lamb` in the market
- **THEN** the field offers "Criar receita lamb"

#### Scenario: Recorded recipe no longer registered

- **WHEN** a writer edits a saved variation with flavor slug `lamb` and the recorded recipe key `lamb-classic`, which the market no longer has
- **THEN** the field offers "Criar receita lamb-classic", not `lamb`

### Requirement: Recipe created from the dialog is selected in the variation

The create form MUST start with the name from the flavor, the key from the candidate and the life stage of the variation, all editable. It MUST say the recipe is registered at once and stays if the variation is not saved. "Cadastrar e vincular", or Enter in its fields, MUST send `POST /api/v1/admin/catalog/recipe-content?market=<saved plan country>` with key, name and life stage, then select the recipe without saving the variation.

#### Scenario: Create and select

- **WHEN** a writer confirms "Cadastrar e vincular" with name "Turkey", key `turkey` and stage Adulto on a BR product
- **THEN** the page sends `{ key: 'turkey', name: 'Turkey', lifeStage: 'adult' }` to the BR recipe route, the field shows "Turkey · turkey" selected and no product PATCH is sent

#### Scenario: Enter in the create form

- **WHEN** a writer presses Enter in the recipe name field of the create form
- **THEN** the page sends the recipe POST and no product PATCH

#### Scenario: Saving the variation links the recipe

- **WHEN** the writer then saves the variation dialog
- **THEN** the variation PATCH carries `recipeKey: 'turkey'`

#### Scenario: Created recipe drives the life stage

- **WHEN** the created recipe has the stage Filhote
- **THEN** the life stage field of the variation shows Filhote and is locked, as for any linked recipe

#### Scenario: Unsaved plan country

- **WHEN** a draft saved as BR has the plan country changed to US on screen and not saved, and a writer creates a recipe from the dialog
- **THEN** the recipe POST goes to the BR market

### Requirement: Recipe creation failures stay inside the dialog

A refused creation MUST keep the variation dialog and the typed variation fields open and MUST show the message in Portuguese. When the API answers `recipe_key_taken`, the page MUST reload the market recipes and select the existing recipe of that key.

#### Scenario: Invalid key

- **WHEN** the API answers 422 `recipe_key_invalid`
- **THEN** the dialog stays open with the variation fields kept and says the key uses only lowercase letters, numbers and hyphens

#### Scenario: Key registered meanwhile

- **WHEN** the API answers 409 `recipe_key_taken` for `turkey` and the reloaded market list has `turkey`
- **THEN** the field selects `turkey` and the dialog says the recipe already existed and was selected

### Requirement: Product page opens the recipe content in a side panel

For a saved variation linked to a recipe, the "Conteúdo" action MUST open a side panel over the product page with the life stage, store presentation, home image, plan thumbnail and label sections of that recipe in the market saved on the product, never an unsaved plan country. The sections MUST behave as on the recipe page and be read-only without `catalog.write`. The panel MUST link to the recipe page, MUST NOT offer rename or delete, and MUST keep keyboard focus inside it while open.

#### Scenario: Writer opens the content of a variation

- **WHEN** a writer clicks "Conteúdo" on a BR variation linked to `beef`
- **THEN** a side panel opens with the five content sections of the BR recipe `beef`, a link to `/catalog/recipes/BR/beef` and no rename or delete action

#### Scenario: Readonly opens the content

- **WHEN** a `readonly` user opens the panel
- **THEN** every section is shown without save, upload or remove controls

#### Scenario: Variation without a recipe

- **WHEN** a variation has no recipe linked
- **THEN** its row has no "Conteúdo" action

#### Scenario: Unsaved plan country

- **WHEN** a draft saved as BR has the plan country changed to US on screen and a writer opens "Conteúdo" of a variation linked to `beef`
- **THEN** the panel loads and saves the BR recipe `beef`

#### Scenario: Focus stays in the panel

- **WHEN** the panel is open and the writer presses Tab on its last control
- **THEN** focus moves to the first control of the panel, not to the product page behind it

### Requirement: Recipe hints of the product page point to the side panel

Texts of the product page that send the operator to edit recipe content MUST point to the side panel instead of the recipe page. This covers the life stage hint of a linked variation, the note after creating a recipe in the variation dialog, and the activation refusal for missing label data or presentation. The life stage hint MUST offer to open the panel on the life stage section.

#### Scenario: Life stage locked by the recipe

- **WHEN** a writer opens the dialog of a variation linked to `beef`
- **THEN** the life stage hint says the stage comes from the recipe and offers "Editar fase", which closes the dialog and opens the panel on the life stage section

#### Scenario: Activation refused for missing presentation

- **WHEN** the API refuses an activation with `missing: ['presentation']`
- **THEN** the message names the store presentation in the recipe content and does not say "na página da receita"

### Requirement: Side panel says the content is shared

The top of the panel MUST state that the content applies to every variation of the market linked to the recipe key, and that changing the life stage changes all of them. It MUST list those variations with their product, including variations of other products.

#### Scenario: Recipe shared by two products

- **WHEN** the recipe `beef` is linked to "Beef 300g" of product A and "Beef 600g" of product B
- **THEN** the panel lists both variations with their product names and says the content applies to 2 variations

### Requirement: Product page reflects what the side panel saved

After each save in the panel and when the panel closes, the product page MUST reload the product. The content badges, the life stage of linked variations and the pending items MUST then show the saved content.

#### Scenario: Image saved from the panel

- **WHEN** a writer saves the home image of `beef` in the panel and closes it
- **THEN** the row of each variation linked to `beef` shows "Imagem cadastrada" and no longer lists "foto" as pending

#### Scenario: Life stage changed from the panel

- **WHEN** a writer saves the stage Filhote in the panel
- **THEN** the variations linked to the recipe show the line Filhote after the reload

### Requirement: Closing the panel with unsaved content asks first

Closing the panel by the close button, Escape or a click outside MUST ask for confirmation when the presentation or label form holds changes that were not saved, or a chosen home image or plan thumbnail was not saved. Declining MUST keep the panel and the typed values.

#### Scenario: Unsaved label

- **WHEN** a writer types an ingredient in the label and presses Escape
- **THEN** the page asks to discard the changes, and declining keeps the panel open with the ingredient

#### Scenario: Nothing changed

- **WHEN** a writer opens the panel and closes it without editing
- **THEN** the panel closes without asking

#### Scenario: Life stage picked and not saved

- **WHEN** a writer picks Filhote in the life stage select without "Salvar fase" and closes the panel
- **THEN** the panel closes without asking and the stage stays as saved, as on the recipe page

### Requirement: Recipe pending items open the missing section

For an inactive variation linked to a recipe, the pending items "foto", "rótulo" and "apresentação" MUST be actions that open the side panel scrolled to the home image, label and store presentation sections. The items "preço", "Stripe" and "NCM", and the recipe items of a variation without a recipe, MUST stay plain text.

#### Scenario: Missing presentation

- **WHEN** a writer clicks "apresentação" in the pending items of a variation linked to `beef`
- **THEN** the panel opens on the store presentation section of `beef`

#### Scenario: Missing price

- **WHEN** a variation lists "preço" as pending
- **THEN** "preço" is plain text and opens nothing

### Requirement: Unsaved product fields are visible

**Salvar** on product detail MUST send the plan country and MUST NOT send `variants`, plan days or large-pack limit. When the country on screen differs from the loaded product, the page MUST say so and that it must be saved before leaving, and closing the browser tab MUST warn. Saving the product or reloading it MUST clear that warning, except the reload after a save in the recipe side panel, which MUST keep the typed country and its warning.

#### Scenario: Product save omits variations

- **WHEN** a session with `catalog.write` saves the plan country on a loaded draft
- **THEN** the PATCH body includes the plan country and does not include `variants` or `planDays`

#### Scenario: Changed field warns before leaving

- **WHEN** a session with `catalog.write` changes the country of a loaded draft and has not saved
- **THEN** the page says the country is changed and must be saved before leaving
