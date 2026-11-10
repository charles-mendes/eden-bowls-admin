## ADDED Requirements

### Requirement: UPS section edits the US dry ice weight per box

"Caixa padrão" in the US rules MUST show "Gelo seco por caixa" (`us.package.dry_ice_kg`, in kg, step 0.1). Its hint MUST say that the weight is declared to UPS as UN1845 and that it goes from 0.1 to 2.5 kg, never more than the box weight. An operator with `shipping.write` MUST save it with the other US rules. Without `shipping.write` the field MUST be read-only. A 422 `invalid_dry_ice_kg` MUST show a Portuguese message, and the page MUST keep the typed value.

#### Scenario: Save a new weight

- **WHEN** an operator sets the dry ice to 1.2 and saves the US rules
- **THEN** the request carries `us.package.dry_ice_kg: 1.2` with the other package fields, and the page confirms the save

#### Scenario: Value from the API

- **WHEN** the settings response has no `dry_ice_kg`
- **THEN** the field shows 0.5

#### Scenario: Refused by the API

- **WHEN** an operator saves a value the browser accepts, such as 3, and the API answers with 422 `invalid_dry_ice_kg`
- **THEN** the page shows "Gelo seco por caixa deve ficar entre 0,1 e 2,5 kg, com uma casa decimal, e não pode passar do peso da caixa." and the field keeps the typed value

#### Scenario: Read-only operator

- **WHEN** an operator without `shipping.write` opens the US rules
- **THEN** the dry ice field is disabled
