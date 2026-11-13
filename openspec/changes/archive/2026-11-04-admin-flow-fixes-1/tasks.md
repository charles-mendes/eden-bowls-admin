# Tasks

Pré-requisito: o change irmão `admin-flow-fixes-1` da API no ar (ver design.md, Migration Plan). Rodar só os testes de cada tela tocada (`npx vitest run <arquivo>`), não a suíte inteira.

## 1. Filtros na URL (base dos links)

- [x] 1.1 Assinantes: ler e gravar `status`, `conta`, `busca`, `pagina` com `useSearchParams` e um helper `billingHref` em `src/lib/`; status desconhecido cai em `active`; "Limpar filtros" remove os parâmetros. Verificar: `src/pages/BillingPage.test.tsx` com casos `?status=past_due`, `?busca=sub_123&status=all` e `?status=xyz`.
- [x] 1.2 Notas fiscais: `status`, `de`, `ate`, `busca`, `pagina` na URL e helper `nfeListHref`; opção "Precisam de ação" (`status=needs_action` na URL, `blocked_missing_document,rejected,error` na requisição). Verificar: `src/pages/NfeListPage.test.tsx` (link com status, voltar mantém filtro, requisição com a lista).
- [x] 1.3 Entregas Brasil: aba em `aba` (`a_despachar`, `em_rota`, `falhas`, `entregues`), padrão `a_despachar`. Verificar: `src/pages/CourierDeliveriesPage.test.tsx` com `?aba=falhas` e `?aba=xyz`.
- [x] 1.4 Estoque: `janela`, `mercado` (só admin), `situacao`, `busca` na URL, com fallback para o padrão em valor inválido ou fora do escopo. Verificar: `src/pages/StockPage.test.tsx` com `?mercado=US&janela=14&busca=frango` e operador BR com `?mercado=US` continuando travado em BR.

## 2. Hoje

- [x] 2.1 Pendência de recusados com vários pedidos: ação "Ver assinantes" para `billingHref({ status: 'past_due' })`. Verificar: `src/pages/DashboardPage.test.tsx`.
- [x] 2.2 Card "Sem etiqueta UPS" e pendência com vários pedidos para `/operations/labels` (ação "Ver etiquetas"); dica do card "Prontos hoje sem etiqueta". Verificar: `DashboardPage.test.tsx`.
- [x] 2.3 `nextStep` com `upsLabel: 'created'` devolve "Aguardando coleta UPS". Verificar: teste de `src/lib/today.ts` (criar `today.test.ts` se não existir) e `DashboardPage.test.tsx`.

## 3. Textos e PDF

- [x] 3.1 `labelIssueText`: novos textos de `po_box_not_allowed`, `military_address_not_supported`, `address_incomplete` e `recipient_name_missing` (o que falta, onde o cliente corrige, WhatsApp). Verificar: `src/pages/LabelQueuePage.test.tsx` e `SubscriptionDetailPage.test.tsx` procuram o texto novo e não encontram "você preenche o nome da conta".
- [x] 3.2 Remover o link "Abrir cliente" ao lado do bloqueio `recipient_name_missing` em `SubscriptionDetailPage.tsx`. Verificar: `SubscriptionDetailPage.test.tsx`.
- [x] 3.3 `openPdf` envia `?account=<stripeAccount da assinatura>`. Verificar: `SubscriptionDetailPage.test.tsx` confere a URL pedida.

## 4. Cliente e NF-e

- [x] 4.1 Clientes → "Endereço de entrega": texto de cópia da conta; "Nome de quem recebe" sem menção a etiqueta; "Salvar endereço" abre confirmação com motivo (3–255) e envia `reason`; cancelar não envia. Verificar: `src/pages/UserDetailPage.test.tsx`.
- [x] 4.2 Clientes → "Dados fiscais": texto dizendo que nota autorizada não muda. Verificar: `UserDetailPage.test.tsx`.
- [x] 4.3 `NfeCustomerDialog`: texto "muda só esta nota" e motivo obrigatório (3–255) enviado como `reason`. Verificar: `src/pages/NfeDetailPage.test.tsx` (sem motivo não envia; com motivo, o corpo traz `reason`).
- [x] 4.4 Detalhe da NF-e: "Abrir cliente" (`/users/<user_id>`) e "Abrir assinatura" (`billingHref({ busca: sub, status: 'all' })`), escondidos sem os ids. Verificar: `NfeDetailPage.test.tsx`, incluindo nota importada sem ids.
- [x] 4.5 Detalhe da NF-e: intervalo de 5 s em `pending`/`submitted` e 60 s nos demais, recalculado a cada carga e após "Nova tentativa". Verificar: `NfeDetailPage.test.tsx` com timers falsos.

## 5. Fila de produção

- [x] 5.1 Linha `ready`: "Expedir" para `/operations/courier` (br + BR) ou `/operations/labels` (us + US), "Mercado divergente" sem link no resto; links de expedição no topo conforme os mercados da sessão. Verificar: `src/pages/ProductionQueuePage.test.tsx` com os três casos.
- [x] 5.2 Modal "Bloquear pedido": aviso de cobrança só para `awaiting_payment`/`past_due`. Verificar: `ProductionQueuePage.test.tsx` (não pago mostra, pago não mostra).
- [x] 5.3 Placeholder da busca "Nome ou e-mail". Verificar: `ProductionQueuePage.test.tsx`. A busca por nome é do irmão da API.

## 6. Estoque

- [x] 6.1 "Adicionar estoque" → "Lançar produção" (botão, menu da linha, título do modal) e texto da Contagem sobre a diferença. Verificar: `StockPage.test.tsx` atualizado para os nomes novos.
- [x] 6.2 Aviso de contagem inicial quando o mercado não tem movimento, só para `production.write`. Verificar: `StockPage.test.tsx` (sem movimento mostra; com movimento e para readonly não mostra).

## 7. Menu e telas por mercado

- [x] 7.1 `AuthContext`: guardar `effectiveMarkets` de `/admin/me`; `src/lib/markets.ts` ganha `effectiveSessionMarkets` (efetivos → `markets` → vazio). Verificar: `src/lib/markets.test.ts`.
- [x] 7.2 `MenuItem.markets` e filtro em `visibleMenuItems`/`groupedMenuItems` (Etiquetas UPS → US; Entregas Brasil e Notas fiscais → BR; lista vazia mostra tudo); `AdminLayout` passa os mercados. Verificar: `src/lib/menu.test.ts` (BR, US, sem mercado).
- [x] 7.3 Hoje usa os mercados efetivos para decidir o card UPS. Verificar: `DashboardPage.test.tsx` com `markets: []` e `effectiveMarkets: ['BR','US']`.
- [x] 7.4 Etiquetas UPS, Entregas Brasil e Notas fiscais mostram "Esta tela é do mercado …" sem requisitar a lista quando a sessão efetiva não tem o mercado. Verificar: `LabelQueuePage.test.tsx`, `CourierDeliveriesPage.test.tsx`, `NfeListPage.test.tsx`.

## 8. Fechamento

- [x] 8.1 Rodar os testes das telas tocadas, `npm run lint` e `npm run build`. Rodar o e2e `admin-readonly` (menu e telas de readonly). Verificar: todos verdes.
- [x] 8.2 Confirmar que `contracts/backend-routes.json` não precisa de sync (`npm run contract:sync` sem diff). Verificar: `git diff --exit-code contracts/`.
