# Proposal

## Why

Fizemos uma caminhada com um operador do Brasil em 08/11/2026 (relatório "Fluxo do operador Brasil — relatório de complexidade"). Ela mostrou três quebras:

- **Pedido some da fila.** Um pedido atrasado marcado pronto sai da fila, e o Expedir não aparece.
- **Hoje cobra pedido travado.** O Hoje mostrou "4 pedidos a despachar", mas nenhum podia sair, porque o endereço não tinha o nome de quem recebe.
- **Despachar sem aviso.** Na assinatura, Despachar deixa o operador preencher o formulário e só depois recusa. A tentativa ainda abre um problema de endereço e manda e-mail ao cliente.

A change irmã `keep-ready-orders-dispatchable` em `eden-bowls-backend` mantém o pronto na fila e entrega `courierIssues`, `courier_issues` e `courierAddressLocked`.

## What Changes

- **Fila de produção:** um pronto do Brasil cujo dia de preparo passou aparece no grupo "Prontos para expedir", acima de "Atrasados". O chip Atrasados conta só o preparo atrasado.
- **Linha pronta do Brasil travada:** quando `courierIssues` não está vazio, a linha mostra "Travado: " e o que falta, nas palavras da Entregas Brasil, no lugar de Expedir. Também mostra o link "Ver na entrega", que abre a Entregas Brasil naquela fatura.
- **Hoje:** o item de despacho passa a ser "N pedidos a despachar · M travados por endereço · K aguardando NF-e". Cada parte só aparece acima de zero. A parte dos travados abre a Entregas Brasil com `problema=endereco`.
- **Filtro `problema=endereco` na Entregas Brasil:** passa a mostrar também as linhas travadas pelo endereço (`issues` não vazio), mesmo sem problema aberto.
- **Assinatura:** com `courier_issues` não vazio, Despachar aparece desabilitado e o motivo vem ao lado. Não há como despachar mesmo assim, como já é na Entregas Brasil.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `operations/production-queue`: o pronto do Brasil fica até a saída, num grupo próprio; a linha travada diz o motivo no lugar de Expedir.
- `operations/today-overview`: o item de despacho diz quantos estão travados por endereço.
- `operations/courier-deliveries`: o filtro de problema de endereço inclui as linhas travadas.
- `operations/subscription-detail`: Despachar travado pelo endereço, com o motivo.

## Impact

- `src/pages/ProductionQueuePage.tsx`: grupo e trava.
- `src/pages/DashboardPage.tsx` e `src/lib/today.ts`: `courierAddressLocked`.
- `src/pages/CourierDeliveriesPage.tsx`: filtro.
- `src/pages/SubscriptionDetailPage.tsx`: botão travado.
- Testes Vitest dessas páginas.
- Sem rota nova: o contrato de rotas não muda.
- Com o backend antigo, os campos novos não vêm. A linha não mostra trava, e o Hoje não mostra "travados", como hoje.
