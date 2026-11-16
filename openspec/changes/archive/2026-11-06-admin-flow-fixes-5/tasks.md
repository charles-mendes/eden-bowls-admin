# Tasks

Rode só os testes relacionados (`npx vitest related <arquivos> --run`). Depende do backend `admin-flow-fixes-5`.

## 1. Base

- [x] 1.1 Tipos e simulação:
  - `stockShortages` no item da produção (`lib/productionQueue.ts`);
  - `range`, `later` e `next_from` nas duas filas;
  - `addressIssues` e `marketExceptions` em `lib/today.ts`;
  - em `src/test/mockAdminFetch.ts`, a rota da prévia do bloqueio e esses campos;
  - `npm run contract:sync`.

  Verificar: `npx tsc --noEmit -p tsconfig.app.json` e o teste de contrato de rotas.
- [x] 1.2 `src/lib/deliveryRange.ts`: ler e escrever `de`/`ate`, presets no fuso dado, `nextFromRange`, `laterRange` e os textos.
  - Verificar: `src/lib/deliveryRange.test.ts` novo (padrão, 7 dias, `next_from` dentro e fora de 31 dias, 7 dias depois de `to`).

## 2. Produção

- [x] 2.1 Selo "Falta estoque" como link (`stockHref`, mercado só com os dois mercados, busca com uma receita) e confirmação antes de "Marcar como pronto" num pedido `short` (`StockShortageConfirm`).
  - Verificar: `ProductionQueuePage.test.tsx` (link com uma e duas receitas, confirmação no `short`, sem confirmação no coberto, "Abrir estoque").
- [x] 2.2 Prévia no modal de bloqueio: pedido só para ciclo não pago, data no fuso do mercado, resposta tardia descartada, texto genérico na falha.
  - Verificar: `ProductionQueuePage.test.tsx` (data na prévia, falha, ciclo pago sem pedido).
- [x] 2.3 Lote:
  - checkbox só nas linhas elegíveis, para `production.write`;
  - seleção limpa ao mudar filtros;
  - barra com as contagens;
  - confirmação com os `short` marcados;
  - envio em série com contador;
  - resumo com falhas e faltas;
  - um reload no fim.

  Verificar: `ProductionQueuePage.test.tsx` (não pago sem checkbox, `readonly` sem checkbox, seleção mista, falha no meio continua, resumo, filtro limpa a seleção).

## 3. Filas

- [x] 3.1 Entregas Brasil:
  - período na URL e na chamada;
  - presets e período livre;
  - aviso de corte com `next_from`;
  - "Mais N pedidos…";
  - texto de `invalid_delivery_range`;
  - `problema=endereco` com o chip.

  Verificar: `CourierDeliveriesPage.test.tsx` (padrão sem query, 7 dias, `later`, corte, filtro do Hoje, período inválido).
- [x] 3.2 Etiquetas UPS: o mesmo com 100 pedidos, as criadas fora do filtro de período e `problema=endereco` só nos prontos.
  - Verificar: `LabelQueuePage.test.tsx` (padrão, criada para depois listada, `later`, filtro).

## 4. Hoje

- [x] 4.1 `fulfillmentItems`:
  - problemas de endereço por mercado, com `stale`, para a fila filtrada;
  - exceções por mercado, para Exceções de mercado;
  - ambos respeitam o mercado na tela.

  Verificar: `DashboardPage.test.tsx` ("N problemas de endereço abertos" com `stale`, US filtrado com exceções, zero não aparece, backend sem os campos).

## 5. Fechamento

- [x] 5.1 `npx vitest related` sobre os arquivos alterados, `npm run build` e lint sem erro novo.
  - Verificar: tudo passa.
