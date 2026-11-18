# Spec Delta

## MODIFIED Requirements

### Requirement: US rules edit the shipping boxes

The US rules MUST show "Caixas de envio" with one row per box in `us.boxes` (Starter Box, Caixa mensal): length, width and height in inches, empty weight in kg to the gram (three decimals) and maximum packs. They MUST be saved with the other US rules by an operator with `shipping.write` and be read-only without it. The section MUST show in fixed and UPS quote modes, because labels use it in both. A 422 `invalid_shipping_box` MUST show "Confira as caixas: medidas acima de 0, peso vazio de 0,1 a 10 kg e a Starter com menos pacotes que a mensal.", keeping the typed values. "Caixa padrão" MUST be titled "Caixa da cotação do checkout" with a hint that it prices the checkout and the simulation only.

#### Scenario: Save the weighed monthly box

- **WHEN** an operator sets the monthly box empty weight to 0.615 and saves the US rules
- **THEN** the request carries `us.boxes` with the monthly `empty_weight_kg` 0.615

#### Scenario: Weights after deploy

- **WHEN** the API returns the Starter at 0.355 kg and the monthly at 0.6 kg
- **THEN** the fields show 0,355 and 0,600

#### Scenario: Refused by the API

- **WHEN** the API answers 422 `invalid_shipping_box`
- **THEN** the page shows the box message and keeps the typed values

#### Scenario: Read-only operator

- **WHEN** an operator without `shipping.write` opens the US rules
- **THEN** the box fields are disabled
