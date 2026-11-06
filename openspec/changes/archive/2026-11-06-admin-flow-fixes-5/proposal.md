# Proposal

## Why

Lote 5 da proposta de melhorias do painel (`docs/analise/proposta-melhorias.md`, na raiz do workspace): volume e conforto. O backend (`admin-flow-fixes-5` em `eden-bowls-backend`) passa a ler as filas por período de entrega, a dar a prévia do bloqueio, a dizer qual receita falta e a contar problemas de endereço e exceções no Hoje. O painel precisa usar isso:

- preparar e marcar pronto em lote;
- avisar antes de deixar o estoque faltar;
- dizer a data da cobrança adiada;
- mostrar no Hoje o que o lote 3 criou;
- deixar ver o resto das filas.

Decisões já tomadas: filtro de data em vez de paginação, `PATCH` em série para o lote (sem rota nova), e PM-09 dentro do lote.

## What Changes

- **Falta de estoque com destino (PM-09).**
  - **Link.** O selo "Falta estoque" vira link para Estoque, filtrado em "Falta" e no mercado. Com uma receita só em `stockShortages`, a busca vem com o nome dela.
  - **Confirmação.** "Marcar como pronto" num pedido `short` pede confirmação antes. Ela lista as receitas em falta e oferece "Abrir estoque". A baixa continua permitida.
- **Ações em lote na produção (PM-10).**
  - **Seleção.** Quem tem `production.write` seleciona, por checkbox, pedidos pagos "A preparar" e pedidos "Em produção" da página.
  - **Ações.** "Iniciar preparo (N)" e "Marcar como pronto (N)" agem só sobre os selecionados que podem receber aquela mudança.
  - **Confirmação.** Lista os pedidos e destaca os `short` com as receitas em falta.
  - **Envio.** O painel chama o `PATCH` existente, um pedido por vez. No fim, mostra quantos mudaram e lista os que falharam, com o motivo.
  - **Fora da seleção.** Pedidos não pagos, bloqueados ou prontos não têm checkbox.
- **Data da cobrança no bloqueio (PM-15).** Ao abrir "Bloquear pedido" num ciclo não pago, o painel pede a prévia (`GET /admin/production/queue/:id/block-preview`) e o aviso passa a dizer "Bloquear adia a cobrança para {dd/mm}". Sem resposta, o aviso genérico de hoje continua.
- **Filas por período (PM-29).**
  - **Filtro.** Entregas Brasil ("A despachar") e Etiquetas UPS ("Prontos") ganham um filtro de período de entrega na URL (`de`, `ate`), com "Até amanhã" (padrão), "Próximos 7 dias" e um período livre.
  - **Corte.** O aviso de corte diz até onde a lista foi e leva a `next_from`.
  - **Depois do período.** "Mais N pedidos depois de {data}" leva aos 7 dias seguintes.
- **Filtro "Com problema de endereço".** As duas filas ganham `problema=endereco` na URL, que mostra só as linhas com um problema de endereço aberto. É o destino do Hoje.
- **Hoje, segunda etapa (PM-26).** Para cada mercado na tela, o Hoje mostra:
  - os problemas de endereço abertos, com quantos estão "sem correção há mais de 2 dias". Abrem a fila do mercado já filtrada;
  - as exceções de mercado, que abrem a página de exceções.
- **Contrato.** `npm run contract:sync` para a rota nova da prévia.

## Capabilities

### New Capabilities

- `operations/production-batch`: seleção e ações em lote na fila de produção.

### Modified Capabilities

- `operations/production-queue`: o selo de falta vira link, a confirmação antes de marcar pronto e a data da cobrança no bloqueio.
- `operations/courier-deliveries`: período de entrega e filtro de problema de endereço.
- `operations/ups-labels`: período de entrega e filtro de problema de endereço.
- `operations/today-overview`: problemas de endereço e exceções de mercado.

## Impact

- **Páginas:**
  - `src/pages/ProductionQueuePage.tsx` (seleção, barra de lote, confirmações, prévia do bloqueio);
  - `src/pages/CourierDeliveriesPage.tsx`, `src/pages/LabelQueuePage.tsx` (período e filtro);
  - `src/pages/DashboardPage.tsx`.
- **Libs:**
  - `src/lib/productionQueue.ts` (`stockShortages`, a ordem do lote);
  - `src/lib/packStock.ts` (`stockHref` já existe);
  - `src/lib/today.ts` (`addressIssues`, `marketExceptions`);
  - uma lib nova `src/lib/deliveryRange.ts` (ler e escrever `de`/`ate`, presets e textos).
- **Testes:** os testes dessas páginas e `src/test/mockAdminFetch.ts` (rota da prévia, `range`/`later`/`next_from`, contagens do Hoje).
- **Contrato:** `contracts/backend-routes.json` com `GET /api/v1/admin/production/queue/:id/block-preview`.
- **Fora do escopo:**
  - uma rota de lote no backend;
  - "prontos aguardando NF-e" (lote 4);
  - coleta UPS (lote 6);
  - paginação.
