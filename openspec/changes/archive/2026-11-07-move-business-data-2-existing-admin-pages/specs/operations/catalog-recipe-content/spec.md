# Spec Delta

## ADDED Requirements

### Requirement: Recipe page edits the store presentation

The recipe page MUST show a section "Apresentação na loja" with the stored presentation of the recipe in its market: short name (`tag`, 1 to 40 characters, the store tab and plan chip label), title, tagline, resume, highlights (one input each, 1 to 8) and the five colors (`color`, `accentColor`, `pillBg`, `pillText`, `pillBorder`). An operator with `catalog.write` MUST be able to save the whole presentation with `PUT /api/v1/admin/catalog/recipe-content/:key/presentation?market=`; without it the fields MUST be read-only and there MUST be no save button. When the API refuses with `recipe_presentation_invalid`, the page MUST mark each listed field as invalid, keep the typed values and name the fields in the message.

#### Scenario: Seeded presentation

- **WHEN** an operator opens the BR `beef` recipe and the API returns its presentation
- **THEN** the section shows its short name, title, tagline, resume, one input per highlight and the five colors

#### Scenario: Save a presentation

- **WHEN** an operator edits the tagline and saves
- **THEN** the page sends the whole presentation to the presentation route of that market and shows a success message

#### Scenario: Invalid color refused

- **WHEN** the API answers 422 `recipe_presentation_invalid` with `colors.pillBg`
- **THEN** the pill background field is marked invalid, the typed values stay and the message names that field

#### Scenario: Recipe without presentation

- **WHEN** the recipe has no stored presentation
- **THEN** the section starts empty and says the variations of the recipe cannot be activated until it is saved
