# Spec Delta

## Purpose

Lets the veterinarian review and change, without a deploy, the life-stage limits, the giant breeds and the energy factors the API uses for the recommendation.

## ADDED Requirements

### Requirement: Nutrition parameters page

The panel MUST have a "Parâmetros nutricionais" item in the Ferramentas group at `/nutrition/settings`, shown to admin, operator, readonly and veterinarian. The page MUST have three tabs: "Fases da vida", "Raças" and "Fatores". Without `nutrition.settings.write` every field MUST be read-only and no save, publish or discard button MUST be shown.

#### Scenario: Operator reads only

- **WHEN** an operator opens the page
- **THEN** the BR limits are shown and there is no "Salvar limites" button

### Requirement: Life-stage limits saved after a preview

The "Fases da vida" tab MUST show, for the chosen market, the adult and senior months of each size class. Saving MUST first call `POST /api/v1/admin/life-stage/preview` with the changed classes. When the preview reports pets changing stage, the page MUST show the count per transition and save with `PUT /api/v1/admin/life-stage/limits` only after confirmation; with no change it MUST save directly. A 422 MUST mark the listed fields.

#### Scenario: Preview before lowering the senior age

- **WHEN** a veterinarian lowers the BR medium senior months from 96 to 84 and saves
- **THEN** the page shows how many pets become senior and sends the `PUT` only after "Confirmar"

#### Scenario: Invalid limits

- **WHEN** the API answers 422 `life_stage_limits_invalid` with `small.senior_from_months`
- **THEN** the small senior field is marked invalid and the message names it

### Requirement: Breeds with their own size class

The "Raças" tab MUST list the breeds of the market with Portuguese name, English name, size class and state. With `nutrition.settings.write`, it MUST allow adding a breed, changing its size class and deactivating or reactivating it, each after the same preview and confirmation. A 409 `life_stage_breed_exists` MUST say the breed is already listed.

#### Scenario: Add a giant breed

- **WHEN** a veterinarian adds "Mastim Napolitano" / "Neapolitan Mastiff" as giant and confirms
- **THEN** the page sends `POST /api/v1/admin/life-stage/breeds` with the market and the breed appears in the list

### Requirement: Energy factors with draft, publication and history

The "Fatores" tab MUST show the published set and its publication date. With `nutrition.settings.write` it MUST edit a draft (created from the published values when none exists) as numeric fields per group and breed lists per energy group, save it with `PUT /api/v1/admin/nutrition/parameters/draft`, discard it, and publish it with `POST /api/v1/admin/nutrition/parameters/publish` after confirmation. The history MUST list previous sets with "Copiar para rascunho". A 422 `nutrition_parameters_invalid` MUST mark the listed fields.

#### Scenario: Publish a changed factor

- **WHEN** a veterinarian changes the senior state factor to 90, saves the draft and confirms the publication
- **THEN** the page sends the whole set with `state.SENIOR` 90, then the publish request, and shows the new published set

### Requirement: Simulator uses the draft on request

The nutrition simulator MUST offer "Simular com o rascunho" to users with `nutrition.settings.write`, sending `parameter_set: "draft"`, and MUST show which set produced the result.

#### Scenario: Simulate the draft

- **WHEN** a veterinarian ticks "Simular com o rascunho" and simulates
- **THEN** the request carries `parameter_set: "draft"` and the result names the draft
