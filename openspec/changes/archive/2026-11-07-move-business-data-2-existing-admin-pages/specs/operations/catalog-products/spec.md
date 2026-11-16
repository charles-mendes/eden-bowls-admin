# Spec Delta

## ADDED Requirements

### Requirement: Plan section edits the large-pack limit

The product "Plano" section MUST show the large-pack limit (`largePackLimit`, 1 to 60) and the weights of the active variations that the recommendation uses as pack sizes. An operator with `catalog.write` MUST be able to save the limit with `PATCH /api/v1/admin/catalog/products/:id`, also while the product is published; in a published product the save MUST send only `largePackLimit`, and plan country and days stay locked.

#### Scenario: Save the limit of a published product

- **WHEN** an operator sets the limit of a published product to 6 and saves
- **THEN** the page sends `{ largePackLimit: 6 }` and shows the saved value

#### Scenario: Out of range

- **WHEN** an operator types 0
- **THEN** the field is marked invalid by its 1 to 60 range and the page does not send the request

### Requirement: Missing presentation blocks activation in the product page

An inactive variation whose recipe has no stored presentation (`recipePresentationReady: false`) MUST list "apresentação" among its pending items, and a refused activation with `presentation` in `missing` MUST name the missing store presentation.

#### Scenario: Activation refused without presentation

- **WHEN** the API refuses an activation with `missing: ['presentation']`
- **THEN** the page says the recipe's store presentation is missing
