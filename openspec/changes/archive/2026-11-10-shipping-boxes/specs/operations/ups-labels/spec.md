## ADDED Requirements

### Requirement: Every box label prints

Printing a shipment's labels MUST fetch one label per package in its `packages` (`/admin/shipments/:id/label?package=N`), in sequence, and put each on its own 4 × 6 in page of the same print job. A shipment without `packages` MUST print its single label as before. A created row MUST show its boxes, for example "2 caixas: mensal 30 · mensal 15".

#### Scenario: Shipment with two boxes

- **WHEN** an operator prints a shipment with two packages
- **THEN** the panel fetches packages 1 and 2 and the print job has two pages

#### Scenario: Label bought before boxes

- **WHEN** an operator prints a shipment without `packages`
- **THEN** the panel fetches the label once, without `package`

### Requirement: Pickup counts boxes

The pickup box count MUST follow the number of packages of the selected labels (one for a label without `packages`) until the operator types a count. The confirmation MUST name the boxes and the labels separately.

#### Scenario: Two labels, three boxes

- **WHEN** an operator selects a label with two packages and a label with one
- **THEN** the box count shows 3 and the confirmation says "3 caixas (2 etiquetas)"
