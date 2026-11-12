# Spec Delta

## Purpose

Gives catalog staff a Recipes area in the panel to register recipes per market, upload each recipe's banner image and fill its label, lets them choose which registered recipe each variation uses, and shows on the variation table which recipe and content each variation has.

## ADDED Requirements

### Requirement: Recipes menu lists the recipes of a market

The panel MUST show a **Receitas** item in the Loja group of the menu for admin, operator and readonly, opening `/catalog/recipes`. The list MUST use the same market filter as Produtos, limited to the session's markets, and show for each registered recipe its name and key, its active and total variations, whether it has an image and its label status. It MUST offer the quick filters **Sem imagem** and **Rótulo incompleto**, the latter also matching recipes without a label.

#### Scenario: Recipes of BR

- **WHEN** a readonly session opens **Receitas** with BR recipes `beef` (2 of 3 variations active, with image) and `senior-lamb` (no variations, no image)
- **THEN** the list shows both recipes with their names and keys, "2/3" and "0/0" variations, and the image and label states

#### Scenario: Quick filter

- **WHEN** an operator turns on **Sem imagem**
- **THEN** only `senior-lamb` stays on the list

### Requirement: Operator registers a recipe

A session with `catalog.write` MUST see **Nova receita**, which opens a dialog with **Nome** and **Chave**. The key MUST be filled from the name as a lowercase slug until the operator edits it, and the dialog MUST say the key cannot change later. API refusals (`recipe_key_taken`, `recipe_key_invalid`, `recipe_name_invalid`) MUST appear in Portuguese inside the dialog, keeping what was typed. After registering, the panel MUST open the recipe page. Readonly MUST NOT see **Nova receita**.

#### Scenario: Register Sênior Cordeiro

- **WHEN** an operator types the name "Sênior Cordeiro" and saves
- **THEN** the panel sends the key `senior-cordeiro` with that name for the selected market and opens `/catalog/recipes/BR/senior-cordeiro`

#### Scenario: Key taken

- **WHEN** the API answers 409 `recipe_key_taken`
- **THEN** the dialog says a recipe with that key already exists in the market and keeps the name and key

### Requirement: Recipe page stands on its own

The recipe page MUST live at `/catalog/recipes/:market/:recipeKey`, independent of any product. It MUST show the recipe name, key and market, and list every variation that uses the key with its name or SKU, its product and a link to the product. Without variations, it MUST explain that a variation is linked through its **Receita (conteúdo)** field. A session with `catalog.write` MUST see **Renomear** and, only when no variation uses the recipe, **Excluir receita**, which asks for confirmation and returns to the list.

#### Scenario: Content page names the sharing variations

- **WHEN** an operator opens the page of `beef` in BR, used by "Beef 300g" and "Beef 500g" of Flavors BR and by "Bovino" of another product
- **THEN** the page says the market is BR and the recipe is `beef`, and lists the three variations with their product names and links

#### Scenario: Unused recipe can be deleted

- **WHEN** an operator opens `senior-lamb`, which no variation uses, and confirms **Excluir receita**
- **THEN** the panel sends the delete and returns to the list without `senior-lamb`

#### Scenario: Recipe in use has no delete

- **WHEN** an operator opens `beef`, which variations use
- **THEN** the page shows **Renomear** and no **Excluir receita**

### Requirement: Variation opens its recipe content page

The variation table MUST show each variation's recipe key and link a saved variation that has one to `/catalog/recipes/:market/:recipeKey` of the product's market. A variation without a recipe key MUST say it has no linked recipe and MUST NOT link.

#### Scenario: Link to the recipe page

- **WHEN** a BR product detail loads a variation with the recipe key `turkey`
- **THEN** its row links to `/catalog/recipes/BR/turkey`

#### Scenario: Variation without a recipe

- **WHEN** a product detail loads a variation whose recipe key is null
- **THEN** its row says it has no linked recipe and has no content link

### Requirement: Variation dialog sets the recipe key

The variation dialog MUST have a **Receita (conteúdo)** select listing the recipes registered in the product's market as name and key, plus **Sem receita**. It MUST explain that variations with the same recipe share image and label and link to **Receitas** to register a new one. A new variation MUST start on the recipe whose key equals its suggested flavor slug when one is registered, otherwise on **Sem receita**. The saved value MUST be sent as `recipeKey`, **Sem receita** as `null`. A 422 `recipe_not_registered` MUST appear in the dialog.

#### Scenario: Unlinking a variation

- **WHEN** an operator picks **Sem receita** for the inactive variation SKU 3000 and saves
- **THEN** the PATCH sends `recipeKey` null and the row says it has no linked recipe

#### Scenario: Registered recipes only

- **WHEN** an operator opens the dialog in a BR product and BR has the recipes `beef` and `senior-beef`
- **THEN** the select offers "Sem receita", `beef` and `senior-beef` with their names, and no free text

#### Scenario: Recipe removed meanwhile

- **WHEN** the API refuses the save with 422 `recipe_not_registered`
- **THEN** the dialog says the recipe is no longer registered in the market and keeps the other fields

### Requirement: Panel checks the image before sending

The panel MUST read the chosen file's type and pixel size before uploading. When the file is not PNG, JPEG or WebP, is larger than 5 MB, or is not 1024 × 636, the panel MUST show the received and the expected values and MUST NOT send the upload. A valid file MUST show a preview before it is saved.

#### Scenario: Oversized photo is stopped in the panel

- **WHEN** an operator picks a 2048 × 1272 PNG on the content page
- **THEN** the panel says the image is 2048 × 1272 and must be 1024 × 636, and no upload request is sent

#### Scenario: Valid photo shows a preview

- **WHEN** an operator picks a 1024 × 636 WebP
- **THEN** the panel shows the preview and offers **Salvar imagem**

### Requirement: Content errors appear on the content page

The panel MUST show the API refusals (`recipe_image_invalid`, `recipe_content_in_use`) in Portuguese inside the card that triggered them, keep the stored content on screen and keep the form values the operator typed.

#### Scenario: Removing the image of an active recipe

- **WHEN** an operator confirms **Remover imagem** and the API answers 409 `recipe_content_in_use`
- **THEN** the Imagem card says the image cannot be removed while a variation of that flavor is active, and the image stays on screen

### Requirement: Label form edits every label field

The Rótulo section MUST edit product name, net weight, freshness note, kcal per kg, kcal per package, manufacturer and address as fields, and ingredients, notices, storage and feeding as lists with add and remove, and analysis as nutrient and value rows. It MUST state the label language from the market (BR Portuguese, US English) and show the status and missing items returned by the API after loading and after each save.

#### Scenario: Saved US label without notices

- **WHEN** an operator saves a US label with ingredients, analysis, kcal per kg and kcal per package and no notice
- **THEN** the section shows **Incompleto** and names the missing notices

#### Scenario: Saved US label with at least one notice

- **WHEN** an operator adds two notices to that label and saves
- **THEN** the section shows **Completo**

### Requirement: Variation table shows the content state

The variation table MUST show, for each variation, whether its flavor has a stored image and whether its stored label is missing, incomplete or complete, as returned by the product detail.

#### Scenario: Flavor with stored image and no label

- **WHEN** a product detail loads a variation whose flavor has a stored image and label status `missing`
- **THEN** the row shows the image as registered and the label as missing

### Requirement: Manual confirmations only for content kept in the store code

The variation dialog MUST show the final-image confirmation only when the flavor has no stored image, and the label-data confirmation only when the stored label is not complete. Each shown confirmation MUST say it is the option for an image or a label kept in the store code.

#### Scenario: Stored image hides the image confirmation

- **WHEN** an operator edits a variation whose flavor has a stored image and label status `incomplete`
- **THEN** the dialog does not show the final-image confirmation and shows the label-data confirmation

### Requirement: Readonly sees content without controls

A session without `catalog.write` MUST see the image, the label and their status on the content page, and MUST NOT see choose, save or remove controls.

#### Scenario: Readonly content page

- **WHEN** a session with only `catalog.read` opens a content page
- **THEN** the image and label are shown and no upload, remove or save control is rendered
