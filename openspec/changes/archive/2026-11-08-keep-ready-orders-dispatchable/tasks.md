## 1. Fila de produção

- [x] 1.1 Em `src/pages/ProductionQueuePage.tsx`, adicionar `courierIssues?: string[] | null` a `QueueItem`.
- [x] 1.2 Agrupar `dueBucket === 'overdue'` com `productionStatus === 'ready'` em "Prontos para expedir", antes de "Atrasados".
- [x] 1.3 Na linha pronta do Brasil com `courierIssues` não vazio, trocar Expedir por "Travado: …" (via `issueCodeText`) e pelo link "Ver na entrega" para `courierPath(item)`.
- [x] 1.4 Testes em `src/pages/ProductionQueuePage.test.tsx`:
  - grupo com um pronto e um a preparar, com o card Atrasados 1;
  - linha travada;
  - linha sem `courierIssues`, que mantém o Expedir;
  - marcar pronto em `?prazo=atrasados`, que leva a linha para o grupo novo.

## 2. Hoje

- [x] 2.1 Em `src/lib/today.ts`, adicionar `courierAddressLocked?: number | null`.
- [x] 2.2 Em `src/pages/DashboardPage.tsx`, adicionar `parts` a `Work`. A linha de despacho passa a montar "· M travados por endereço" (link `problema=endereco`, com o singular "travado") e "· K aguardando NF-e".
- [x] 2.3 Testes em `src/pages/DashboardPage.test.tsx`:
  - 4 a despachar e 4 travados;
  - 5, 1 e 2 (as três partes);
  - travados 0 ou ausente, sem a parte;
  - os casos de NF-e que já existem continuam passando.

## 3. Entregas Brasil

- [x] 3.1 Em `src/pages/CourierDeliveriesPage.tsx`, o filtro `problema=endereco` passa a aceitar `issues` não vazio além do `address_issue` aberto.
- [x] 3.2 Teste em `src/pages/CourierDeliveriesPage.test.tsx`: uma linha travada sem problema aberto aparece com o filtro.

## 4. Assinatura

- [x] 4.1 Em `src/pages/SubscriptionDetailPage.tsx`, adicionar `courier_issues` ao detalhe. Com trava, Despachar fica desabilitado e a frase "Travado: …" aparece na seção Entrega Brasil.
- [x] 4.2 Testes em `src/pages/SubscriptionDetailPage.test.tsx`:
  - travado: botão desabilitado e nenhum diálogo abre;
  - lista vazia: o diálogo abre como antes;
  - campo ausente: comportamento de hoje.

## 5. Fechamento

- [x] 5.1 Rodar `npx vitest run` nos quatro arquivos de teste, `npx tsc -b` e o lint. O contrato de rotas não muda.
- [x] 5.2 Testar com o backend da change irmã e o operador do Brasil:
  - marcar pronto um pedido atrasado;
  - ver "Prontos para expedir";
  - ver a trava na linha, no Hoje e na assinatura.
