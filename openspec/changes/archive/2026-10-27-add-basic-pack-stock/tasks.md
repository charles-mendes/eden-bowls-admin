# Tasks

Sai depois do change de mesmo nome da API (`eden-bowls-backend`). Rode só os testes relacionados (`npx vitest run <arquivo>`; Playwright com `--workers=4` e o arquivo do spec).

## 1. Contrato e menu

- [x] 1.1 Com o manifesto da API publicado, rodar `npm run contract:sync`. Acrescentar "Estoque" (Operação, depois de "Fila de produção", papéis `admin`, `operator`, `readonly`) a `src/lib/menu.ts` e a rota `/operations/stock` a `src/App.tsx`. Verificar com `npx vitest run src/lib/menu.test.ts src/lib/api.test.ts`: os cenários "Operator sees Estoque" e "Veterinarian does not see Estoque".

## 2. Página de estoque

- [x] 2.1 Criar `src/lib/packStock.ts` (tipos, rótulos de movimento e motivo, formatação do item e mensagens dos códigos de erro) e `src/pages/StockPage.tsx` com os filtros de janela e mercado, a tabela ordenada por "A produzir" e o alerta de linhas sem tamanho acima dela (decisões 1, 2 e 4). Verificar com `npx vitest run src/pages/StockPage.test.tsx`: os cenários "Kitchen sees what to produce", "Empty market", "Operator BR is locked", "Delivery with an unsized line" e "No unsized lines".
- [x] 2.2 Diálogos "Lançar produção", "Ajustar" e "Definir mínimo", visíveis só com `production.write`, recarregando a tabela depois de salvar (decisão 3). Verificar com o mesmo teste: os cenários "Record a batch", "Unknown size from the API" e "Readonly sees no actions", e a nota obrigatória com o motivo "Outro".
- [x] 2.3 Histórico paginado abaixo da tabela, com filtro por item e tipo, e link para a assinatura em Separação e Estorno (decisão 6). Verificar com o mesmo teste: o cenário "Separation links to the subscription".

## 3. Fila de produção

- [x] 3.1 Acrescentar `stockCoverage` e o objeto `stock` da resposta aos tipos de `src/lib/productionQueue.ts`, o badge de cobertura na coluna Produção e o aviso não bloqueante depois de marcar como pronto (decisão 5). Verificar com `npx vitest run src/pages/ProductionQueuePage.test.tsx`: os cenários "Later delivery is short", "Ready cycle has no badge" e "Marked ready with too little stock", com todos os testes atuais passando.

## 4. E2E e verificação

- [x] 4.1 Criar `e2e/specs/admin-stock.spec.ts` (listar, lançar produção, ajustar) e cobrir Estoque sem ações em `admin-readonly.spec.ts` e o badge em `admin-production.spec.ts`. Verificar com `npx playwright test e2e/specs/admin-stock.spec.ts e2e/specs/admin-readonly.spec.ts e2e/specs/admin-production.spec.ts --workers=4`.
- [x] 4.2 Rodar `npx vitest run --changed`, `npx tsc -b` e `npm run lint`.
