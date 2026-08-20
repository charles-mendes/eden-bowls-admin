# Onboarding 360 (consulta operacional)

## Origem WP

Lista **somente leitura** de `shop_order` com meta `_hsr_onboarding_session_id`. Detalhe + CSV. Não corrige pet, não retoma sessão, não mexe em Stripe.

Filtros “profundos” (customer, frequency, query, stripe_status, stripe_link) abandonavam paginação SQL e faziam scan das **até 500** ordens mais recentes. Cards “Vinculados / Ativos / Com simplificado” contavam **só a página visível**. Não copiar nenhum dos dois.

## Mudança de modelo (crítica)

No Node **não há** `hsr_onboarding_sessions` nem pedido Woo como agregado.

Identidade = JWT `user_id`. O checkout grava `onboarding_user_state.checkout_reference` (JSON). Pets ficam em `onboarding_pets` (PK UUID, FK `user_id`, soft-delete `deleted_at`). Plano/recorrência/endereço/frete/pagamento são colunas JSON do mesmo state. Assinatura viva está no ledger `stripe_subscriptions`.

**Não reimplementar “sessão com expiresAt”.** O SPA atual (`GET /admin/onboarding/sessions`) copia o modelo WP e deve ser reescrito.

Unidade operacional convertida:

```
CheckoutOnboarding = um user_id que tem checkout_reference
                     (+ N linhas no ledger stripe_subscriptions, se houver)
```

Um mesmo usuário pode ter **mais de uma assinatura Stripe** (uma por pet no modelo de negócio). A tela de detalhe lista **N assinaturas**, não assume 1:1.

## Objetivo no portal

Suporte achar um checkout de onboarding por e-mail, `user_id`, `sub_…` ou `cus_…`, ver pets, recomendação simplificada, prazo, produtos e estado Stripe **persistido**.

Rotas React: manter `/onboarding/sessions` como path (ou renomear para `/onboarding/checkouts`). Conteúdo muda. Arquivos atuais: `OnboardingPage.tsx`, `OnboardingSessionPage.tsx`.

O Dashboard (`DashboardPage.tsx`) usa as **mesmas métricas** — abandonar `totalSessions` / `expiringIn24h`.

## Regras a preservar

1. Somente leitura. Sem PATCH de pet/sessão/Stripe.
2. Recorrência exibida = snapshot (`weekly|biweekly|monthly` em `onboarding_user_state.recurrence`), **não** o interval Stripe.
3. Vínculo Stripe = presença de linha no ledger daquele `user_id` (ou `stripe_subscription_id` no `checkout_reference`).
4. Status Stripe = valor do ledger (webhook), não live query na listagem.
5. Recomendação simplificada = consumo já calculado nos pets / `simplified-consumption` — **não** recalcular só com o checkout. Se não houver dados: empty “Sem dados simplificados”, não erro.
6. Checkout sem snapshot: empty state, não 500. JSON inválido → `{ _raw, _warning: "invalid_json" }`.
7. CSV = mesma query filtrada. Sem teto silencioso de 500 (paginar de verdade; se houver limite, avisá-lo na UI). CSV **não** inclui coluna de simplified (paridade WP).
8. KPIs no **conjunto filtrado**, não na página visível.

## Lista — colunas alvo

| Coluna WP | Fonte Node |
|---|---|
| Pedido / Sessão | **some.** Substituir por `userId` |
| Cliente | `wp_users.user_email` + `display_name` |
| Data | `onboarding_user_state.updated_at` / timestamp em `checkout_reference` |
| Recomendação simplificada | pets + `simplified-consumption` (daily / monthly / packs) |
| Assinatura Stripe | ledger `stripe_subscription_id` (se N: contar / “N vinculadas”) ou “Não vinculado” |
| Status Stripe | `stripe_subscriptions.status` (se N: o mais recente, ou “misto”) |
| Total 1ª fatura | snapshot em `checkout_reference` (quando existir) |
| Prazo | `plan_selection.subscription_term_months` / ledger `subscription_term_months` |
| Recorrência | `recurrence.frequency` |
| Ações | detalhe |

Filtros server-side: `email`, `userId`, `stripeSubscriptionId`, `stripeStatus`, `link` (`linked|unlinked`), `frequency`, `market`, `from`, `to`. `perPage` 20/50/100 (default 20).

Default order: mais recente primeiro.

## Detalhe

`:id` da rota React deixa de ser UUID de sessão e passa a ser **`userId`**.

Blocos (união do 360 WP + metabox de pedido, porque no Node não haverá tela Woo):

1. Cliente (`userId`, email, `display_name`, `activation_status`).
2. Stripe: **lista** de assinaturas do ledger (id, status, `current_period_end`, `cancel_at_period_end`, `plan_label`).
3. Pets (`onboarding_pets` não deletados): name, breed, age_years/months, weight_input + weight_unit, activity_level, pet_condition, neutered + simplified (daily/monthly/packs). Pet sem nome → “Unnamed pet”.
4. Recorrência / `plan_selection` / term months.
5. Endereço + frete snapshot (`address`, `shipping`).
6. Desconto 1ª compra no `checkout_reference` (promo, %, duration, amount paid, eligibility reason). Sem metas → “Não aplicável / inelegível”, sem recálculo live.
7. Meal plan / line items se persistidos no snapshot (`plan_selection.catalog_pricing.line_items`).
8. JSON técnico recolhido (`checkout_reference`, `payment_reference`).

Empty state se não houver `checkout_reference`.

## Rotas backend

**Não usar** as rotas de onboarding da loja (`/onboarding/pets`, `/plan-selection`, `/recommendation`, etc.): elas mutam o **próprio** JWT.

### Criar

```
GET  /api/v1/admin/onboarding/checkouts
GET  /api/v1/admin/onboarding/checkouts/:userId
GET  /api/v1/admin/onboarding/checkouts.csv
GET  /api/v1/admin/onboarding/metrics
```

Permission: `onboarding.read`.

Query da lista: `page`, `perPage`, `email`, `userId`, `stripeSubscriptionId`, `stripeStatus`, `link` (`linked|unlinked`), `frequency`, `market`, `from`, `to`.

Envelope da lista:

```ts
{
  total: number
  page: number
  perPage: number
  totalPages: number
  items: Array<{
    userId: string
    email: string
    displayName: string | null
    accountStatus: string
    marketCountry: string | null
    frequency: string | null
    termMonths: number | null
    stripeSubscriptionIds: string[]
    stripeStatus: string | null
    petsCount: number
    hasSimplified: boolean
    updatedAt: string
  }>
}
```

Métricas (default **global**; query de filtros opcional):

```ts
{
  totalCheckouts: number
  linkedToStripe: number
  stripeActive: number          // active + trialing no ledger (qualquer sub do user)
  withSimplified: number
  generatedAt: string
}
```

O SPA hoje espera `totalSessions` / `expiringIn24h` / `byStatus`. **Abandonar expiração de sessão.** Mapear cards do Dashboard e da lista para o shape acima.

CSV: mesmos filtros; colunas da lista **sem** texto de simplified.

## Relação com telas atuais do SPA

| SPA hoje | Conversão |
|---|---|
| `GET /admin/onboarding/sessions` | virar `GET /admin/onboarding/checkouts` |
| `GET /admin/onboarding/sessions/:id` | `:userId` |
| Tabela `sessionPets` / `answers` / `recommendationRuns` | pets + state JSON; answers/runs WP **não existem** no Node — não recriar tabelas só para a UI |
| `checkoutOrders[]` | um `checkout_reference` + **array** de subscriptions do ledger |
| Dashboard `totalSessions` / `expiringIn24h` | `totalCheckouts` / `linkedToStripe` / `stripeActive` / `withSimplified` |

## O que não copiar

- Scan PHP de 500 pedidos.
- KPI da página visível.
- `session_id` como chave.
- Cards “expiram em 24h” (não há TTL de sessão no Node).
- Ações de escrita (retomar token, editar pet, reenviar OTP).
- CRUD de raças (não havia no WP).
- Assumir 1 assinatura por checkout.
