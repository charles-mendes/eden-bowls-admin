## ADDED Requirements

### Requirement: Deliveries show the box count

Each courier delivery MUST show how many boxes it carries, from its `boxes`, for example "2 caixas". A delivery without `boxes` MUST show nothing extra.

#### Scenario: Two-box delivery

- **WHEN** a delivery has two boxes
- **THEN** it shows "2 caixas"
