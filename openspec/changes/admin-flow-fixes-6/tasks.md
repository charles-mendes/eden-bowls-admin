# Tasks

Rode só os testes relacionados (`npx vitest run <arquivo>`). Depende do backend `admin-flow-fixes-6`.

## 1. Tipos e textos

- [x] 1.1 `src/lib/upsLabels.ts`: tipo `UpsPickup` (lista) e `pickup` nos itens `created` da fila; `pickupErrorText(code)` com os códigos da spec; `pickupLabel(pickup)`.

  Verificar: teste de `upsLabels` (cada código tem texto; `pickupLabel` para `requested`, `unknown` e `null`; data `dd/mm`).
- [x] 1.2 `src/lib/shippingSettings.ts`: `phone` em `UsShipFrom` e nos padrões.

  Verificar: teste existente das configurações de frete continua passando; um caso novo lê o telefone.

## 2. Configurações > Frete

- [x] 2.1 `HeadquartersCard.tsx`: campo "Telefone" com a dica, no rascunho e no corpo salvo.

  Verificar: teste do cartão (ou de `ShippingPage`): salvar manda `us.ship_from.phone`.

## 3. Etiquetas UPS

- [x] 3.1 `src/components/shipping/UpsPickupSection.tsx`: lista das etiquetas sem coleta (marcadas), formulário (data, janela, quantidade sugerida), confirmação, `POST /admin/shipments/pickups`, PRN, textos de erro, lista de coletas com "Cancelar coleta" e "Não foi criada", e só leitura sem `shipping.write`.
- [x] 3.2 `LabelQueuePage.tsx`: a seção em `#coleta`, recarga da fila em `onChanged`, e a coleta (ou "Sem coleta") em cada linha de "Etiquetas criadas".
- [x] 3.3 Simulação em `src/test/mockAdminFetch.ts` e `src/test/fixtures.ts` para as quatro rotas e `pickup` na fila.

  Verificar (3.1–3.3): `npx vitest run src/pages/LabelQueuePage.test.tsx` com os cenários da spec (segunda com 8; pedido manda o corpo certo e mostra o PRN; nada para coletar; só leitura; `pickup_ship_from_incomplete` com link; `pickup_unconfirmed` recarrega; cancelar; não foi criada; linha com e sem coleta; quantidade editada não acompanha a seleção).

## 4. Hoje

- [x] 4.1 `src/lib/today.ts` e `DashboardPage.tsx`: `upsLabelsWithoutPickup` com o item e o link `/operations/labels#coleta`, só com os EUA na tela.

  Verificar: `npx vitest run src/pages/DashboardPage.test.tsx` (3 etiquetas; singular; zero ou ausente não mostra; filtro Brasil não mostra).

## 5. Fechamento

- [ ] 5.1 `npm run contract:sync` com o backend do lote 6 e commitar `contracts/backend-routes.json`; `npx vitest run` nos arquivos alterados, `npm run lint` e `npx tsc --noEmit`.
