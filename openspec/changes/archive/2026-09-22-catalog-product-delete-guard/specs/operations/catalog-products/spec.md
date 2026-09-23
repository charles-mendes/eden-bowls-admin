# Spec Delta

## MODIFIED Requirements

### Requirement: Product list offers an explicit detail action

The catalog product list MUST show an actions column for every session that can open the list. Each row MUST include a **Detalhes** control that navigates to `/catalog/products/:id` for that product. The product name MUST remain a link to the same detail. **Excluir** MUST appear only for a session with `catalog.write` when that product’s `canDelete` is true, and MUST keep asking for confirmation before delete. When the session has `catalog.write`, `canDelete` is false, and the product is published, the row MUST show **Desativar** and MUST NOT show **Excluir**. When the session has `catalog.write`, `canDelete` is false, and the product is a draft, the row MUST NOT show **Excluir** or **Desativar**, and MUST say that the product is linked to a subscription and cannot be deleted.

#### Scenario: Reader sees Detalhes and not Excluir

- **WHEN** a session with `catalog.read` and without `catalog.write` opens `/catalog/products` and the list has a product
- **THEN** the row shows **Detalhes** to that product’s detail and does not show **Excluir** or **Desativar**

#### Scenario: Writer sees Detalhes beside Excluir

- **WHEN** a session with `catalog.write` opens `/catalog/products` and a product has `canDelete` true
- **THEN** the row shows **Detalhes** and **Excluir** for that product

#### Scenario: Linked published product offers Desativar

- **WHEN** a session with `catalog.write` opens `/catalog/products` and a published product has `canDelete` false
- **THEN** the row shows **Desativar** and does not show **Excluir**
- **AND** confirming **Desativar** sends `PATCH` with `active` false and does not send `DELETE`

#### Scenario: Linked draft product has no destructive action

- **WHEN** a session with `catalog.write` opens `/catalog/products` and a draft product has `canDelete` false
- **THEN** the row does not show **Excluir** or **Desativar** and says the product is linked to a subscription and cannot be deleted

### Requirement: Detail mutations wait until the product loads

On product detail, **Salvar**, **Publicar**, **Desativar**, **Sincronizar Stripe**, and **Excluir produto** MUST NOT be rendered until the product GET has resolved. A session without `catalog.write` MUST NOT see save, publish, deactivate, or delete. A session without `catalog.sync` MUST NOT see **Sincronizar Stripe**. After the product has loaded, a publish of that loaded record MUST send the loaded plan and variations, not an empty draft. **Salvar** MUST stay disabled while the loaded product is published. **Desativar** is the control that unpublishes a loaded published product (`PATCH` with `active` false). **Excluir produto** MUST appear only when the loaded product has `canDelete` true.

#### Scenario: Publish is absent while the product is loading

- **WHEN** a session with `catalog.write` and `catalog.sync` opens a product detail and the product GET has not resolved
- **THEN** **Publicar**, **Desativar**, **Salvar**, **Sincronizar Stripe**, and **Excluir produto** are not on the screen and no PATCH has been sent

#### Scenario: Readonly detail has no mutations

- **WHEN** a session with only `catalog.read` opens a loaded product detail
- **THEN** save, publish, deactivate, sync, and delete controls are absent

#### Scenario: Publish uses the loaded product

- **WHEN** a session with `catalog.write` publishes a loaded draft
- **THEN** the PATCH body includes that product’s plan country, plan days, and variations, plus `active` true

#### Scenario: Published linked product deactivates instead of deleting

- **WHEN** a session with `catalog.write` opens a loaded published product whose `canDelete` is false
- **THEN** the screen shows **Desativar** and does not show **Excluir produto**
- **AND** confirming **Desativar** asks to take the product off the store while keeping the record and current billing, then sends `PATCH` with `active` false

## ADDED Requirements

### Requirement: Stale delete refreshes the product actions

When delete returns HTTP 409 with `product_in_use` or `variation_in_use`, the panel MUST tell the operator the product is already on a subscription and cannot be deleted, and MUST reload the list or the detail so the actions match the new `canDelete`. A failed Stripe archive (HTTP 502) MUST leave the product on screen.

#### Scenario: Delete conflicts after the page was opened

- **WHEN** a session with `catalog.write` confirms **Excluir** and the delete responds 409 `product_in_use`
- **THEN** the panel shows that the product is on a subscription and cannot be deleted, and requests the list or detail again

#### Scenario: Stripe archive failure keeps the row

- **WHEN** delete responds 502 because the Stripe archive failed
- **THEN** the product remains on the list or detail and the panel shows the failure

### Requirement: A linked variation cannot be deleted on its own

On a loaded product detail, **Excluir** for a variation MUST appear only when that variation’s `canDelete` is true. A variation with `canDelete` false MUST NOT offer **Excluir** or **Desativar**, and MUST say it is in use on a subscription. Another variation on the same product with `canDelete` true MUST still offer **Excluir**.

#### Scenario: One linked variation blocks only itself

- **WHEN** a loaded product has one variation with `canDelete` false and another with `canDelete` true
- **THEN** only the unlinked variation shows **Excluir**, and the linked variation says it is in use on a subscription
