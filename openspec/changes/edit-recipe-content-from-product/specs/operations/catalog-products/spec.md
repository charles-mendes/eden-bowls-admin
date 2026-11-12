# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Unsaved plan fields are visible

**Salvar** on product detail MUST send plan country and plan days and MUST NOT send `variants`. When the country, duration or large-pack limit on screen differs from the loaded product, the page MUST say so and that it must be saved before leaving, and closing the browser tab MUST warn. Saving the product or reloading it MUST clear that warning, except the reload after a save in the recipe side panel, which MUST keep the typed plan fields and their warning.

#### Scenario: Product save omits variations

- **WHEN** a session with `catalog.write` saves plan country and plan days on a loaded draft
- **THEN** the PATCH body includes plan country and plan days and does not include `variants`

#### Scenario: Changed duration warns before leaving

- **WHEN** a session with `catalog.write` changes the duration of a loaded draft and has not saved
- **THEN** the page says country and duration are changed and must be saved before leaving

#### Scenario: Side panel save keeps a typed duration

- **WHEN** a writer changes the duration of a draft from 30 to 15, does not save, and saves the home image in the recipe side panel
- **THEN** after the product reload the duration still shows 15 and the unsaved warning stays

#### Scenario: Side panel save keeps a typed limit on a published product

- **WHEN** a writer changes the large-pack limit of a published product from 8 to 6, does not save, and saves the label in the recipe side panel
- **THEN** after the product reload the limit still shows 6 and the unsaved warning stays
