# Proposal

## Why

O change irmão da API (`add-basic-pack-stock` em `eden-bowls-backend`) cria o saldo de packs prontos por mercado, receita e tamanho, dá baixa quando a Fila de produção marca um ciclo como pronto e calcula quanto a semana compromete. Sem tela, a cozinha não lança produção, não vê o "a produzir" e não percebe na fila quais entregas o saldo não cobre. Esta é a parte do painel.

## What Changes

- **Novo item "Estoque"** (`/operations/stock`, grupo Operação), para `admin`, `operator` e `readonly`, oculto para a veterinária.
  - Tabela por receita e tamanho com: em estoque, comprometido (com a parte aguardando pagamento), disponível, a produzir e mínimo. Itens com disponível negativo ou abaixo do mínimo ficam destacados.
  - Filtros: janela de 7, 14 ou 30 dias e mercado (admin escolhe BR ou US; equipe de um mercado fica travada no seu).
  - Ações para quem tem `production.write`: "Lançar produção", "Ajustar" (com motivo) e "Definir mínimo". Para `readonly`, a tela é só leitura.
  - Alerta quando alguma entrega da janela tem packs sem tamanho, que por isso não entram no comprometido, com link para a assinatura.
  - Histórico de movimentos do mercado, filtrável por item e tipo, com quem fez ou o ciclo que gerou o movimento.
- **Fila de produção**:
  - Cada ciclo ainda não separado mostra se o saldo atual o cobre ("Coberto", "Falta estoque" ou "Sem tamanho").
  - Ao marcar um ciclo como pronto e o saldo ficar negativo, a fila mostra um aviso com os itens que faltaram. A ação nunca é bloqueada.
- Contrato: `npm run contract:sync` com as rotas novas da API.

## Capabilities

### New Capabilities

- `operations/pack-stock`: página de estoque de packs (visão da janela, lançamento de produção, ajuste, mínimo e histórico).

### Modified Capabilities

- `operations/production-queue`: a fila passa a exibir a cobertura de estoque de cada ciclo e o aviso de falta depois de marcar como pronto.

## Impact

- `src/App.tsx`, `src/lib/menu.ts` e `src/lib/menu.test.ts`.
- Página nova `src/pages/StockPage.tsx`, com teste, e lib nova `src/lib/packStock.ts`.
- `src/pages/ProductionQueuePage.tsx`, `src/lib/productionQueue.ts` e os testes deles.
- `contracts/backend-routes.json`; e2e novo `e2e/specs/admin-stock.spec.ts` e cobertura em `admin-readonly.spec.ts` e `admin-production.spec.ts`.
- Depende do change da API publicado antes.
