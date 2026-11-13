# Tasks

Rodar só os testes relacionados (`npx vitest run <arquivo>`), nunca a suíte inteira. Depende do change `admin-flow-fixes-2` do backend.

## 1. Base

- [x] 1.1 Tipos novos em `src/lib/` (fulfillment e último contato de Hoje, `failure_kind`, campos novos da fila do courier, ciclos pagos, contatos) e rotas novas em `src/test/mockAdminFetch.ts`. Verificar: `npx tsc --noEmit -p tsconfig.app.json`.

## 2. Hoje (PM-03, PM-26)

- [x] 2.1 `nextStep`: `unresolved` → "Verificar na UPS" (erro, `/operations/labels#verificar-ups`); BR pago e pronto por `courierDelivery`: `none` → "Despachar", `out_for_delivery` → "Em rota" (`aba=em_rota`), `delivered` → "Entregue", `failed` → "Despachar de novo" (`aba=falhas`). "Pronto para entregar" sai. Verificar: teste de `nextStep` em `DashboardPage.test.tsx` com os quatro casos e o `unresolved`.
- [x] 2.2 Lista "Expedição e notas" com as contagens de `fulfillment` acima de zero, do mercado em tela, com links filtrados; "Bling desconectado" quando `blingConnected === false` e o Brasil está em tela. Verificar: `DashboardPage.test.tsx` (BR com contagens, tudo zero, admin com Bling desconectado, admin filtrado em US sem o aviso, mercado US não mostra BR).
- [x] 2.3 Último contato e "Registrar contato" na pendência de pagamento recusado, com o telefone do item no diálogo. Verificar: `DashboardPage.test.tsx` (com e sem telefone).

## 3. Contatos (PM-17)

- [x] 3.1 `src/components/CustomerContact.tsx`: Dialog (motivo, resultado, nota ≤ 500), telefone com copiar, erro mantém os campos, texto do último contato. Verificar: teste do componente (salvar, erro, readonly sem botão).

## 4. Entregas Brasil (PM-11, PM-12)

- [x] 4.1 Linha com endereço para copiar, quem recebe, telefone com copiar, instruções do perfil, sabores e pacotes. Verificar: `CourierDeliveriesPage.test.tsx` (linha completa, sem telefone, copiar endereço).
- [x] 4.2 Texto do campo de link no despacho (Uber já vem selecionado). Verificar: `CourierDeliveriesPage.test.tsx`.
- [x] 4.3 "Editar" em rota (modal preenchido com os dados gravados daquela entrega e refeito a cada abertura, `PATCH`, sem confirmação de não pronto). Verificar: `CourierDeliveriesPage.test.tsx` (abre com meio, link, custo e nota gravados; editar duas entregas seguidas mostra os dados de cada uma; troca do link; readonly sem botão).
- [x] 4.4 "Falhou" com tipo obrigatório e o tipo na linha de "Falhas"; "Registrar contato" em "Em rota" e "Falhas". Verificar: `CourierDeliveriesPage.test.tsx`.

## 5. Etiquetas UPS (PM-20)

- [x] 5.1 Lote envia `confirm_not_ready` só para os confirmados; 409 `ups_label_needs_confirmation` vira "Precisa confirmar" e o lote segue. Verificar: `LabelQueuePage.test.tsx`.
- [x] 5.2 `Section` aceita `id`; "Verificar na UPS" com `id="verificar-ups"` e rolagem até ela depois do carregamento quando o hash é `#verificar-ups`. Verificar: `LabelQueuePage.test.tsx`.

## 6. Detalhe da assinatura (PM-13, PM-20, PM-17)

- [x] 6.1 "Envio UPS" e "Entrega Brasil" a partir de `paid-cycles`, sem depender da sincronização; fatura sem ciclo não aparece. Verificar: `SubscriptionDetailPage.test.tsx`.
- [x] 6.2 Compra de etiqueta trata o 409 com confirmação e reenvio. Verificar: `SubscriptionDetailPage.test.tsx`.
- [x] 6.3 Histórico de contatos e "Registrar contato". Verificar: `SubscriptionDetailPage.test.tsx`.

## 7. Fechamento

- [x] 7.1 `npx vitest related --run` nos arquivos alterados, `npm run lint` (nenhum erro novo) e `npm run build`. Rodar o e2e `admin-readonly`. Verificar: todos verdes.
- [x] 7.2 `npm run contract:sync` com o backend novo e commit de `contracts/backend-routes.json` com as três rotas novas. Verificar: o Vitest de contrato passa.
