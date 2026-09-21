# Proposal

## Why

No painel, Recorrência (Mensal / Quinzenal / Semanal) é o prazo da loja com outro nome: o tutor escolhe 1 / 3 / 6 meses e o backend só aliasa isso para `monthly` / `biweekly` / `weekly`. Isso confunde operação, e a lista ainda mostra o prazo como `1m` / `3m` / `6m` enquanto o detalhe 360 já usa “1 mês”. A fila de produção repete o compacto `1m`.

## What Changes

- Lista de checkouts (`/onboarding/sessions`): coluna **Prazo (plano escolhido)** com prazo por extenso (`1 mês` / `3 meses` / `6 meses` / `—`); remover a coluna Recorrência.
- Detalhe 360: tirar Recorrência do grid do plano; manter o dump JSON retitulado para não parecer escolha do cliente.
- Fila de produção: mesma forma por extenso no sublinha do plano (não `Nm`).
- CSV `GET /admin/onboarding/checkouts.csv`: manter colunas antigas na mesma ordem; acrescentar `termLabel` **no fim**; `frequency` permanece como legado (Mensal/Quinzenal/Semanal). **Não é BREAKING** para quem lê por nome de coluna ou por posição das colunas atuais.
- Sem BOM UTF-8 neste change. Sem apagar `recurrence` no banco, na API JSON, nem o POST da loja.

## Capabilities

### New Capabilities

- `operations/onboarding-checkouts`: como a lista, o detalhe 360 e o CSV de checkouts apresentam o prazo escolhido na loja e deixam de tratar Recorrência como dado operacional.

### Modified Capabilities

- `operations/production-queue`: o termo ao lado de `plan_label` na coluna Plano passa a ser o prazo por extenso, alinhado à lista de checkouts.

## Impact

- **Admin (este repo):** `OnboardingPage`, `checkoutSnapshot`, `CheckoutSnapshotPanels`, `ProductionQueuePage`, `formatTermMonths` / testes Vitest, Playwright `admin-onboarding`.
- **Backend (repo irmão `eden-bowls-backend`):** `admin-onboarding.service.js` `toCsv` + teste Jest. API JSON da lista continua enviando `frequency` e `termMonths` numérico.
- **Fora de escopo:** prazo divergente em linhas “Misto” (lista lê `plan_selection`, não as N assinaturas Stripe); BOM no CSV; loja; `POST /onboarding/recurrence`; slots de cupom `1m`.
