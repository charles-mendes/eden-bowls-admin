# shipping-settings Specification

## Purpose

Covers the shipping settings that operators edit on `/shipping`.

## Requirements

### Requirement: UPS section edits the US maximum transit days

The UPS section of the US rules MUST show "Prazo máximo de trânsito" (`us.max_transit_days`, 1 to 10 business days), and an operator with `shipping.write` MUST save it with the other US rules. Above 1 day, the page MUST warn that the insulated box was planned for about 48 hours.

#### Scenario: Save two days

- **WHEN** an operator sets the transit limit to 2 and saves the US rules
- **THEN** the request carries `us.max_transit_days: 2` and the page shows the insulated-box warning

#### Scenario: Value from the API

- **WHEN** the settings response has no `max_transit_days`
- **THEN** the field shows 1, the value before this change

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

### Requirement: US rules edit the shipping boxes

The US rules MUST show "Caixas de envio" with one row per box in `us.boxes` (Starter Box, Caixa mensal): length, width and height in inches, empty weight in kg and maximum packs. They MUST be saved with the other US rules by an operator with `shipping.write` and be read-only without it. The section MUST show in fixed and UPS quote modes, because labels use it in both. A 422 `invalid_shipping_box` MUST show "Confira as caixas: medidas acima de 0, peso vazio de 0,1 a 10 kg e a Starter com menos pacotes que a mensal.", keeping the typed values. "Caixa padrão" MUST be titled "Caixa da cotação do checkout" with a hint that it prices the checkout and the simulation only.

#### Scenario: Save the weighed monthly box

- **WHEN** an operator sets the monthly box empty weight to 1.7 and saves the US rules
- **THEN** the request carries `us.boxes` with the monthly `empty_weight_kg` 1.7

#### Scenario: Refused by the API

- **WHEN** the API answers 422 `invalid_shipping_box`
- **THEN** the page shows the box message and keeps the typed values

#### Scenario: Read-only operator

- **WHEN** an operator without `shipping.write` opens the US rules
- **THEN** the box fields are disabled
