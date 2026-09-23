# operations/subscription-detail Specification

## Purpose

Lets operators read a subscription ledger's stored product mix, delivery address, and freight quote without parsing raw JSON, while keeping the original payloads available for support.

## Requirements

### Requirement: Subscription detail shows the stored product mix

The subscription detail page MUST replace the raw Snapshots JSON blocks with a section titled **Detalhes do produto**. That section MUST describe the values as the checkout snapshot, without a live recalculation. Pets and flavors MUST come from the stored plan selection. Each pet row MUST show the plan pet name and the selected flavors. When a flavor has a stored weight, the row MUST show that weight next to the flavor. When the plan selection includes catalog line items, the section MUST also show a table with pet, item, quantity, pack size, unit price, and line total. When the plan selection has no catalog line items, that table MUST NOT appear.

#### Scenario: Flavor mix without line items

- **WHEN** an operator opens a subscription whose plan selection lists pet `luna` with flavors `beef` and `fish` at weights 5 and 5, and no catalog line items
- **THEN** **Detalhes do produto** shows `luna` with `beef` and `fish` each weighted 5, and no item price table

#### Scenario: Catalog line items

- **WHEN** the plan selection includes catalog line items for those flavors
- **THEN** the section also shows quantity, pack size, unit price, and line total for each item

### Requirement: Snapshot-only pets stay visible

A pet present only in `petsSnapshot` MUST still appear in the product table. Its flavor cell MUST be empty. When the same pet id exists in both payloads with different names, the table MUST show the name from the plan selection.

#### Scenario: Pet missing from the plan

- **WHEN** `petsSnapshot` names a pet that the plan selection does not list
- **THEN** that pet appears in the product table with an empty flavor cell

#### Scenario: Names diverge for the same pet

- **WHEN** the same pet id is `Luna` in `petsSnapshot` and `luna` in the plan selection
- **THEN** the product table shows `luna`

### Requirement: Address and freight stay readable

The page MUST show **Endereço** and **Frete** as separate sections, not inside the product section and not as raw JSON. A stored address MUST be shown as formatted lines (street and number, complement, neighborhood, city and state, postal code, country) plus phone and delivery instructions when those fields exist. When no address is stored, the section MUST show **Sem endereço na cópia gravada**. Freight MUST show method, cost, distance, rate, delivery time, quoted postal code, and quote time when those fields exist. A missing freight field MUST be omitted. A missing freight payload MUST NOT invent a cost. Section descriptions MUST say the values are the stored checkout copy and MUST NOT say they are recalculated live.

#### Scenario: Complete address and freight

- **WHEN** the subscription stores a street address and a distance-based freight quote
- **THEN** the operator sees the formatted address and the stored freight method, cost, distance, and delivery time

#### Scenario: Incomplete address and no freight

- **WHEN** the address has no usable lines and freight is absent
- **THEN** the address section shows **Sem endereço na cópia gravada** and the freight section does not show a cost

### Requirement: Technical JSON stays collapsed

The four stored payloads (`petsSnapshot`, `planSelection`, `address`, `shipping`) MUST remain available under **JSON técnico**, each in a collapsed disclosure. The raw JSON MUST NOT be visible until the operator opens that disclosure. The subscription detail page MUST NOT show discount or payment snapshot sections.

#### Scenario: Page load hides raw JSON

- **WHEN** an operator opens the subscription detail
- **THEN** the product, address, and freight sections are visible and the raw JSON text is not

#### Scenario: Operator opens a payload

- **WHEN** the operator expands a technical JSON disclosure
- **THEN** that payload's stored JSON is shown
