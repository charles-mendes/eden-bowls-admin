# Design

## Context

- `ProductDetailPage.tsx` holds `planDays` / `largePackLimit` state (`planDaysField`, `largePackLimitField`, `DEFAULT_LARGE_PACK_LIMIT`), the "Plano" section with the active weights, and sends plan days on save and publish. `ProductsPage` create sends plan days.
- Per-market settings screens already exist under Configurações (`admin-settings`: company, legal, automated emails) with a market selector; catalog screens use the Produtos market filter.

## Goals / Non-Goals

**Goals:** one screen per market for plan days and limit; product page without plan values.

**Non-Goals:** changing the recommendation preview; moving plan country out of the product (it stays until `product-is-recipe`).

## Decisions

- **Screen under Loja (`/catalog/plan`), not Configurações.** The routes and permissions are `catalog.*`; staff who edit products are the ones who tune packs. Configurações tabs require `settings.read`.
- **Reuse the Produtos market filter component** and the existing number validation of `largePackLimitField`, extended to plan days (integer > 0).
- **Show the pack weights** from the products list already loaded for the market (active variations' weights), as the removed "Plano" section did.

## Risks / Trade-offs

- [Backend deployed before the panel] → The old panel still sends `planDays`; the API ignores it (backend design). No breakage.
