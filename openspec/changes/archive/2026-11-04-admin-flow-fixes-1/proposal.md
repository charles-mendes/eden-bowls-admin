# Proposal

## Why

O levantamento operacional do painel (`docs/analise/analise-operacional.md`, na raiz do workspace) achou atalhos que levam à tela errada, textos que mandam o operador fazer o que ele não pode ou não deve, e filtros que se perdem a cada visita. Este é o lote 1 da proposta de melhorias (`docs/analise/proposta-melhorias.md`): correções e ajustes que **não mudam o que o sistema permite**. As travas novas (NF-e, endereço, mercado de saída) ficam para os lotes 3 e 4.

## What Changes

- **Hoje → pagamentos recusados (PM-01).** Com mais de um recusado, "Ver assinantes" abre `/billing?status=past_due`, e Assinantes lê o status da URL. Hoje a lista abre em "Ativa" e não mostra os recusados.
- **Hoje → etiquetas UPS (PM-02).** O card "Sem etiqueta UPS" e a pendência com vários pedidos abrem Etiquetas UPS (`/operations/labels`), não a fila de produção. Com um pedido só, a pendência continua abrindo a assinatura.
- **Hoje → próximo passo (PM-04).** "Etiqueta criada: despachar" vira "Aguardando coleta UPS", sem verbo de ação, porque o painel não tem ação de despacho para o US.
- **Textos de etiqueta bloqueada (PM-05).** `recipient_name_missing` deixa de mandar o operador preencher o nome da conta. Todos os bloqueios de endereço dizem o que falta, onde o cliente corrige na loja e que, se não resolver, o operador fala com ele pelo WhatsApp.
- **PDF Stripe (PM-06).** O botão manda a conta Stripe da assinatura. Hoje o admin dos dois mercados recebe 404.
- **Cópias de endereço como exceção (PM-07).** Em Clientes, "Endereço de entrega" diz que não muda o endereço da caixa (a entrega usa o da assinatura, que o cliente edita na loja). Salvar pede confirmação e um motivo, que vai para a auditoria. "Corrigir dados" da NF-e pede motivo da mesma forma. Nenhum campo novo de endereço.
- **Fila de produção → expedir (PM-08).** A linha `ready` troca "Concluído" por "Expedir": Entregas Brasil quando conta e endereço são BR, Etiquetas UPS quando são US. Quando conta e país divergem, a linha mostra "Mercado divergente" sem link.
- **Filtros na URL (PM-14).** Assinantes (status, conta, busca), Notas fiscais (status, período, busca), Entregas Brasil (aba) e Estoque (situação, janela, busca) guardam os filtros na URL.
- **Bloquear pedido não pago (PM-15, só texto).** O modal avisa que bloquear um ciclo ainda não cobrado adia a cobrança, e reabrir pode cobrar na hora.
- **NF-e ligada à assinatura e ao cliente (PM-16).** O detalhe ganha "Abrir cliente" e "Abrir assinatura". A atualização automática passa a rodar a cada 5 s enquanto a nota está `pending` ou `submitted` (hoje é 60 s para tudo). A lista ganha o filtro "Precisam de ação" (`blocked_missing_document`, `rejected`, `error`).
- **Busca da fila por nome (PM-18).** A busca da fila de produção casa o nome que a fila mostra, além do e-mail. Placeholder "Nome ou e-mail".
- **Estoque com os nomes da cozinha (PM-19).** "Adicionar estoque" vira "Lançar produção". "Contagem" explica que o sistema lança só a diferença. Sem nenhum movimento no mercado, a página sugere começar pela contagem inicial.
- **Menu por mercado (PM-27).** Etiquetas UPS só aparece para quem tem o mercado US; Entregas Brasil e Notas fiscais só para quem tem BR. O menu usa os mercados efetivos que a API devolve em `/admin/me`. Uma tela de outro mercado aberta pela URL diz "Esta tela é do mercado X".

A proteção de mercado e de permissão continua no backend. Nenhuma trava nova, nenhuma rota nova.

## Capabilities

### New Capabilities

- `operations/today-overview`: a página Hoje (`/dashboard`): cards, pendências e próximo passo por pedido, e para onde cada um leva.
- `operations/nfe-invoices`: lista e detalhe de notas fiscais no painel: filtros, ligação com cliente e assinatura, atualização e correção dos dados do cliente.
- `operations/courier-deliveries`: tela Entregas Brasil no painel, começando pela aba guardada na URL.
- `operations/customer-detail`: a página do cliente (`/users/:userId`) e como ela apresenta as cópias de endereço e de dados fiscais.

### Modified Capabilities

- `operations/billing-subscribers`: filtros de Assinantes lidos e gravados na URL.
- `operations/subscription-detail`: o PDF Stripe manda a conta da assinatura.
- `operations/production-queue`: ação "Expedir" na linha `ready`, aviso de cobrança no bloqueio, busca por nome.
- `operations/pack-stock`: "Lançar produção" no lugar de "Adicionar estoque", explicação da contagem, sugestão de contagem inicial, filtros na URL.
- `operations/admin-market-scope`: itens do menu e telas por mercado, a partir dos mercados efetivos da sessão.
- `operations/admin-panel-copy`: textos dos bloqueios de etiqueta UPS.

## Impact

- Painel: `src/pages/DashboardPage.tsx`, `src/lib/today.ts`, `src/pages/BillingPage.tsx`, `src/lib/upsLabels.ts`, `src/pages/SubscriptionDetailPage.tsx`, `src/pages/UserDetailPage.tsx`, `src/pages/NfeDetailPage.tsx`, `src/components/NfeCustomerDialog.tsx`, `src/pages/NfeListPage.tsx`, `src/pages/ProductionQueuePage.tsx`, `src/pages/CourierDeliveriesPage.tsx`, `src/pages/StockPage.tsx`, `src/pages/LabelQueuePage.tsx`, `src/lib/menu.ts`, `src/components/AdminLayout.tsx`, `src/contexts/AuthContext.tsx`, `src/lib/markets.ts`, testes dessas telas e o e2e `admin-readonly`.
- Change irmão na API (mesmo nome, `eden-bowls-backend`): `effectiveMarkets` em `/admin/me`, `reason` auditado em `PATCH /admin/users/:userId/delivery` e `PATCH /admin/nfe/:id/customer`, lista de status em `GET /admin/nfe`, busca da fila pelo nome. Nenhuma rota nova: `contracts/backend-routes.json` não muda.
- Conflito a resolver antes do apply: o change em andamento `add-fulfillment-tracking-and-delay-notices` (0/36 tarefas) também troca a ação da linha `ready` ("Gerar etiqueta"/"Registrar envio") e propõe `local_deliveries`, que o change arquivado `br-courier-delivery` da API substituiu por `courier_deliveries`. Ver design.md.
