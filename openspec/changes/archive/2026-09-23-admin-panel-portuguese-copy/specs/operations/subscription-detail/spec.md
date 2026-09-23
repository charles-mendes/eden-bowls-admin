# Spec Delta

## MODIFIED Requirements

### Requirement: Address and freight stay readable

The page MUST show **Endereço** and **Frete** as separate sections, not inside the product section and not as raw JSON. A stored address MUST be shown as formatted lines (street and number, complement, neighborhood, city and state, postal code, country) plus phone and delivery instructions when those fields exist. When no address is stored, the section MUST show **Sem endereço na cópia gravada**. Freight MUST show method, cost, distance, rate, delivery time, quoted postal code, and quote time when those fields exist. A missing freight field MUST be omitted. A missing freight payload MUST NOT invent a cost. Section descriptions MUST say the values are the stored checkout copy and MUST NOT say they are recalculated live.

#### Scenario: Complete address and freight

- **WHEN** the subscription stores a street address and a distance-based freight quote
- **THEN** the operator sees the formatted address and the stored freight method, cost, distance, and delivery time

#### Scenario: Incomplete address and no freight

- **WHEN** the address has no usable lines and freight is absent
- **THEN** the address section shows **Sem endereço na cópia gravada** and the freight section does not show a cost
