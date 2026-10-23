# Spec Delta

## Purpose

Gives catalog staff a page in the panel to upload each recipe's banner image and fill its label per market, and shows on the variation table which flavors already have stored content.

## ADDED Requirements

### Requirement: Variation opens its recipe content page

The variation table MUST link every saved variation to `/catalog/products/:productId/recipes/:flavorSlug` for its flavor. The content page MUST name the market and list every variation that shares the content, by name or SKU, so the operator knows a change applies to all of them.

#### Scenario: Content page names the sharing variations

- **WHEN** an operator opens the content page of `senior-beef` from the 300 g variation of Flavors BR, which also has a 500 g `senior-beef` variation
- **THEN** the page says the market is BR and lists both variations

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
