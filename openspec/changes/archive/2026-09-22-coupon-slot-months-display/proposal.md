# Proposal

## Why

Na tela `/billing/coupons`, a tabela “Promotion codes recentes” mostra o slot como `6m`, `3m` ou `1m`. Operação precisa ler o prazo por extenso (`6 meses`), no mesmo padrão já usado em onboarding e na fila de produção. O QA apontou essa célula.

## What Changes

- Coluna **Slot** da tabela de promotion codes passa a mostrar `1 mês` quando o slot é 1, `<n> meses` quando o slot é um número finito maior que 1, e `-` quando o slot é ausente, vazio ou não positivo.
- A célula deixa de concatenar `m` (`6m`).
- Alertas da mesma página (`Mapa incompleto (6m)`, códigos ausentes ou inativos) e os rótulos `1 mês(es)` / placeholder `First purchase 6m` permanecem como estão.
- O JSON de `GET /admin/stripe/promotion-codes` continua enviando `slot` numérico (`1` / `3` / `6`) ou `null`. Não é **BREAKING**.

## Capabilities

### New Capabilities

- `operations/billing-coupons`: como a coluna Slot da tabela de promotion codes apresenta o prazo do slot de 1ª compra.

### Modified Capabilities

- Nenhuma. As specs atuais de onboarding, fila de produção, catálogo, assinatura e escopo de mercado não descrevem essa tabela.

## Impact

- **Admin (`eden-bowls-admin`):** `CouponsPage` usa `formatTermMonths` na célula Slot; Vitest de `CouponsPage` passa a esperar `1 mês`. Sem mudança de layout, cor ou tipografia.
- **Backend (`eden-bowls-backend`):** sem alteração. `listRecentPromotionCodes` já devolve `slot` como número do prazo mapeado ou `null`. A formatação é só na UI.
- **Loja (`eden-bowls`):** sem alteração. O checkout usa `subscription_term_months` numérico e não lê a coluna Slot do painel.
- **Sem tarefas** nos repos da loja e do backend: a mudança não altera contrato de API, persistência nem tela da loja.
