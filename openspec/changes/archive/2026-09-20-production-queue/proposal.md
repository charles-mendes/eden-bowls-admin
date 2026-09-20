# Proposal

## Why

Cris precisa ver, na cozinha, quais assinaturas vencem em breve e o que produzir (packs, sabores, cliente) — e marcar o ciclo como a preparar / em produção / pronto / bloqueado. Hoje não existe tela, rota, permissão nem tabela de produção: `/orders` só redireciona para Onboarding 360, e Assinantes (`/billing`) lista o ledger Stripe com filtro `status=active` exato, ordenação por `updated_at DESC` e sem packs/sabores. O KPI `renewing7d` conta em memória e não devolve as linhas da fila.

## What Changes

- Nova tela operacional **Produção** em Operação (`/operations/production`) para `admin`, `operator` e `readonly`, com quatro KPIs civis (Vence hoje, Amanhã, Próximos Nd, Atrasados), filtros de janela/conta/status de produção/busca/atrasados, tabela ordenada por vencimento e ações de status.
- Novos endpoints `GET /api/v1/admin/production/queue` e `PATCH /api/v1/admin/production/queue/:id`, com `production.read` / `production.write`. PATCH envia `periodEnd` e exige nota (1–255) ao bloquear.
- Overlay fino `subscription_production_cycles` (`subscription_id` + `period_end`). Ausência de linha = `to_prepare`. Não duplica o ledger Stripe nem o JSON de packs/sabores.
- Fila: `active` / `trialing` / `past_due` com `current_period_end`; **fora** `cancel_at_period_end` e status pausado/cancelado/incomplete. Janela civil inclui “vence hoje” mesmo depois do timestamp UTC.
- Índice `(status, current_period_end)` no ledger; presenter achata packs/sabores/`lineItems` sem rua, CEP ou last4.
- Audit `production.status.update` via `AdminAuditService`. Permissões espelhadas no painel (fixtures, mocks, menu, E2E readonly).

Não é **BREAKING**: Assinantes, métricas de billing e `/orders` permanecem. A fila não reusa `GET /admin/billing/subscriptions`.

## Capabilities

### New Capabilities

- `operations/production-queue`: fila operacional de produção a partir do ledger Stripe (`current_period_end`), overlay de status de cozinha, API admin e tela em Operação.

### Modified Capabilities

- (nenhuma — o inventário de specs do painel está vazio; Assinantes/billing não têm spec de requisitos a alterar)

## Impact

- **Admin (este repo):** `ProductionQueuePage`, rota, menu Operação, fixtures/`WRITE_PERMISSIONS`/`readonlyUser`, mocks, Vitest, Playwright `admin-production` + `admin-readonly` + `menu.test`. Implementar depois do backend (tasks 4–5).
- **Backend (repo irmão `eden-bowls-backend`):** migration `0018` (FK + overlay), `listQueue`, presenter, service, rotas, `admin-roles.js`, wiring. Tasks 1–3 primeiro. OpenSpec vive no admin.
- **Dados:** `stripe_subscriptions` + JSON `plan_selection`/`address` + `wp_users.display_name`. Ciclos só no primeiro PATCH. Sem last4/rua/CEP no DTO.
- **Fora de escopo (v1):** máquina Woo, invoices locais, grams diários, lead time ≠ `current_period_end`, auto-`ready` via UPS, bloco na ficha do assinante, timezone de cozinha US.
