# catalog-recipe-content Specification

## Purpose

Lets staff register the recipes of each market and edit, in the market language, the content every linked variation shares: life stage, store presentation, home image, plan thumbnail and label, on the recipe page or from the product, so a content change needs no deploy.

## Requirements

### Requirement: Product page edits the store presentation

The **Apresentação** tab of the product page MUST show the stored presentation of the product in its market: short name (`tag`, 1 to 40 characters, the store tab and plan chip label), title, tagline, resume, highlights (one input each, 1 to 8) and the five colors (`color`, `accentColor`, `pillBg`, `pillText`, `pillBorder`). An operator with `catalog.write` MUST be able to save the whole presentation with `PUT /api/v1/admin/catalog/products/:productId/content/presentation`; without it the fields MUST be read-only and there MUST be no save button. When the API refuses with `recipe_presentation_invalid`, the page MUST mark each listed field as invalid, keep the typed values and name the fields in the message.

#### Scenario: Seeded presentation

- **WHEN** an operator opens the BR `beef` product and the API returns its presentation
- **THEN** the tab shows its short name, title, tagline, resume, one input per highlight and the five colors

#### Scenario: Save a presentation

- **WHEN** an operator edits the tagline and saves
- **THEN** the page sends the whole presentation to the presentation route of that product and shows a success message

#### Scenario: Invalid color refused

- **WHEN** the API answers 422 `recipe_presentation_invalid` with `colors.pillBg`
- **THEN** the pill background field is marked invalid, the typed values stay and the message names that field

#### Scenario: Recipe without presentation

- **WHEN** the product has no stored presentation
- **THEN** the tab starts empty and says the variations of the product cannot be activated until it is saved

### Requirement: Panel checks the image before sending

The panel MUST read the chosen file's type and pixel size before uploading. When the file is not PNG, JPEG or WebP, is larger than 5 MB, or is not 1024 × 636 nor close enough for the API to resize it (at most 25% of enlargement, so at least 820 × 509, and at most 15% of the width or height cut off), the panel MUST show the received and the expected values and MUST NOT send the upload. A valid file MUST show a preview before it is saved.

#### Scenario: Oversized photo is stopped in the panel

- **WHEN** an operator picks an 800 × 800 PNG on the content page
- **THEN** the panel says the image is 800 × 800 and must be 1024 × 636 or a close size of at least 820 × 509, and no upload request is sent

#### Scenario: Close photo is accepted

- **WHEN** an operator picks a 1024 × 576 PNG
- **THEN** the panel shows the preview, says it will be adjusted to 1024 × 636, and offers **Salvar imagem**

#### Scenario: Valid photo shows a preview

- **WHEN** an operator picks a 1024 × 636 WebP
- **THEN** the panel shows the preview and offers **Salvar imagem**

### Requirement: Content errors appear on the content page

The panel MUST show the API refusals (`recipe_image_invalid`, `recipe_content_in_use`) in Portuguese inside the tab that triggered them, keep the stored content on screen and keep the form values the operator typed.

#### Scenario: Removing the image of an active recipe

- **WHEN** an operator confirms **Remover imagem** and the API answers 409 `recipe_content_in_use`
- **THEN** the **Imagens** tab says the image cannot be removed while a variation of this product is active, and the image stays on screen

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

### Requirement: Recipe content sections are addressable

The life stage, store presentation, home image, plan thumbnail and label sections MUST carry the stable anchors `fase`, `apresentacao`, `imagem`, `miniatura` and `rotulo` on the product page. Opening the product page with one of these anchors in the URL MUST open the tab that holds the section and scroll to it once the product loads.

#### Scenario: Link to the label

- **WHEN** an operator opens `/catalog/products/42#rotulo`
- **THEN** the page opens the **Rótulo** tab after the product loads

#### Scenario: Unknown anchor

- **WHEN** the URL carries `#outra-coisa`
- **THEN** the page opens on **Dados gerais** as without an anchor
