# Tasks

Rode só os testes relacionados (`npx vitest related <arquivos> --run`). Depende do backend `admin-flow-fixes-3`.

## 1. Base

- [ ] 1.1 `src/lib/addressIssues.ts`:
  - tipo `AddressIssue`;
  - `issueCodeText`, um texto por código, BR e US;
  - `addressIssueState`, que dá o estado do e-mail e os dias sem correção.

  Componente `src/components/AddressIssueStatus.tsx`.
  - Verificar: `src/lib/addressIssues.test.ts`, com cada código e os quatro estados.
- [ ] 1.2 Atualizar `src/test/fixtures.ts` e `src/test/mockAdminFetch.ts` com:
  - os campos novos: `issues`, `address_issue`, `missing_fields`, `shipment_market`, `market_exception`;
  - a rota `GET /admin/market-exceptions`.

  Rodar `npm run contract:sync` depois do manifesto do backend.
  - Verificar: o teste de contrato passa.

## 2. Exceções de mercado

- [ ] 2.1 `MarketExceptionsPage.tsx`, rota `/operations/market-exceptions` e item "Exceções de mercado" em `menu.ts` (`shipping.read`).
  - Verificar: teste da página (lista, vazio, link) e `menu.test.ts` (sem permissão, sem item).
- [ ] 2.2 Aviso de exceção no `SubscriptionDetailPage.tsx`.
  - Verificar: teste do detalhe com `market_exception: true`.

## 3. Trava e problema de endereço

- [ ] 3.1 `CourierDeliveriesPage.tsx`:
  - a linha com `issues` lista o que falta e não tem "Despachar";
  - `AddressIssueStatus` na linha;
  - `courierErrorText` com `courier_address_incomplete` e `shipment_market_exception`.

  Verificar: testes da página de courier e do diálogo.
- [ ] 3.2 `LabelQueuePage.tsx` e `upsLabels.ts`: o texto de `shipment_market_exception` e `AddressIssueStatus` nas linhas prontas.
  - Verificar: testes de etiquetas.
- [ ] 3.3 `SubscriptionDetailPage.tsx`: seção do problema de endereço, com o estado do e-mail e "Registrar contato".
  - Verificar: teste do detalhe (aberto, resolvido, sem problema).
- [ ] 3.4 `NfeDetailPage.tsx`: o que falta (`missing_fields`), onde o cliente corrige e o estado do e-mail.
  - Verificar: teste do detalhe da NF-e.

## 4. Fechamento

- [ ] 4.1 `npx vitest related` sobre os arquivos alterados, `npm run build` e lint sem erro novo.
  - Verificar: tudo passa.
