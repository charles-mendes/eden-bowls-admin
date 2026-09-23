# Design

## Context

See proposal.md for why. The list already links the product name to `/catalog/products/:id`. The actions column is rendered only when the session has `catalog.write`, and then it only shows Excluir. Detail mutations are gated by permission (`catalog.write` for save, publish, and delete; `catalog.sync` for Stripe sync), but those buttons mount before `data` exists, so Publicar runs against the empty initial draft.

`active` on the catalog payload is the post status `publish`. The list calls that column Ativo and prints Sim/Não. The detail prints “Ativo: sim”.

The create form already limits plan country to `sessionMarkets`. The detail select hardcodes BR and US. `operations/admin-market-scope` already requires catalog country controls to follow the session. `GET` of a product already rejects a record outside the actor’s market. `PATCH` still accepts a `planCountry` of BR or US without checking that the new country is in the session.

## Goals / Non-Goals

**Goals:**

- Make Detalhes an obvious row action without removing the name link.
- Hide write and sync actions until the product GET resolves.
- Use Publicado / Rascunho for the same `active` flag on both screens.
- Stop inventing `28` when `planDays` is null.
- Limit the detail country select to session markets.

**Non-Goals:**

- Changing catalog HTTP contracts, Stripe sync, or publish rules on the server.
- Rejecting a cross-market `planCountry` inside `patchProduct`.
- Any change in `eden-bowls` or `eden-bowls-backend`.

## Decisions

1. **Detalhes is a `ghost-button` link inside `.table-actions`, same as feedbacks.** The name link stays. Excluir stays a `danger-button` and stays behind `catalog.write`. Alternative: make the whole row clickable. Rejected because delete is on the same row and a row click would fight that button.

2. **Unloaded detail renders no mutation buttons, rather than rendering them disabled.** A disabled Publicar can still be easy to miss in a test, and the bug is that the control exists and its handler treats missing `data` as “not active”. Absence is the guard. Permissions stay as they are once `data` is set: write sees save, publish, and delete; sync sees Sincronizar Stripe; read sees none. Salvar stays disabled when the loaded product is already published.

3. **One vocabulary for `active`.** Both screens use the badges already in the panel: Publicado (`badge-success`) and Rascunho (`badge-warning`). The list column stops saying Ativo. Alternative: keep Sim/Não on the list and Publicado on the detail. Rejected because staff would read them as two fields.

4. **Null `planDays` stays an empty field and is omitted from the PATCH.** The server ignores `planDays` only when the key is absent or null; sending `0` from an empty number input returns 422. A product that already has days keeps that number in state and in the body. The fallback `|| 28` goes away.

5. **Detail country options come from `sessionMarkets`, like create.** A single-market session has one option. An admin session keeps BR and US. The server is unchanged, so a hand-built PATCH can still set the other country. That matches create, which is also only a panel lock.

6. **Publication controls move above the variation table, and Voltar sits in the page actions.** The table is ten columns wide; Publicar, sync, and delete currently sit under it. Copy for sync status, blocked publish, and the sync result is display-only and does not change the request.

## Risks / Trade-offs

- [Staff can still PATCH another country outside the panel] → Accepted. Same as product creation. Closing it in `patchProduct` would be a backend behavior change and is out of scope.
- [Buttons pop in after load] → Accepted. The alternative is a control that can publish an empty draft.
- [Empty duration cannot be saved as a number] → Omit `planDays` when the field is empty so the server does not receive `0`. Do not substitute `28`.

## Migration Plan

Panel-only. Deploy the admin build. Rollback is the previous admin build. No data migration.

## Open Questions

None.
