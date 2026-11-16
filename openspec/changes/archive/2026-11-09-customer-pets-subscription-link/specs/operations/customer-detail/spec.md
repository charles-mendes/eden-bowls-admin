# Spec Delta

## ADDED Requirements

### Requirement: Pet cards show the subscription that owns the pet

Each pet card in the "Pets" tab MUST show one badge per item of the pet's `subscriptions`, in the order the API sends. Each badge MUST show the Stripe id and the status label, with the status color subscription cards use, and MUST link to that subscription's detail. With `subscriptions: []` the card MUST show "Sem assinatura". When the pet has no `subscriptions` key, the card MUST show neither.

#### Scenario: Pet on an active subscription

- **WHEN** pet `Luna` carries `subscriptions: [{ id: "11", stripeSubscriptionId: "sub_br", status: "active" }]`
- **THEN** its card shows "sub_br" with "Ativo", linking to `/billing/subscriptions/11`

#### Scenario: Pet on a paused and an active subscription

- **WHEN** pet `Luna` carries an `active` subscription `sub_new` followed by a `paused` one `sub_old`
- **THEN** its card shows "sub_new" with "Ativo" first and "sub_old" with "Pausado" after it

#### Scenario: Pet without a subscription

- **WHEN** pet `Luna` carries `subscriptions: []`
- **THEN** its card shows "Sem assinatura"

#### Scenario: API without the link

- **WHEN** pet `Luna` has no `subscriptions` key
- **THEN** its card shows no subscription badge and no "Sem assinatura"

### Requirement: Subscription cards list their pets

Each subscription card in the "Assinaturas" tab MUST show a "Pets" item with the names from the subscription's `pets`, in the order the API sends, separated by commas. A pet with an empty name MUST show as "Pet sem nome". With `pets: []` the item MUST show "-". When the subscription has no `pets` key, the item MUST NOT show.

#### Scenario: Subscription with two pets

- **WHEN** a subscription carries `pets: [{ id: "rex", name: "Rex" }, { id: "luna", name: "Luna" }]`
- **THEN** its card shows "Pets" with "Rex, Luna"

#### Scenario: Pet without a name

- **WHEN** a subscription carries `pets: [{ id: "rex", name: "" }]`
- **THEN** its card shows "Pets" with "Pet sem nome"

#### Scenario: Canceled subscription

- **WHEN** a subscription carries `pets: []`
- **THEN** its card shows "Pets" with "-"

#### Scenario: API without the pets

- **WHEN** a subscription has no `pets` key
- **THEN** its card shows no "Pets" item
