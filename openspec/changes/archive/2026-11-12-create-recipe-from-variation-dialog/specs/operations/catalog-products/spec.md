# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

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
