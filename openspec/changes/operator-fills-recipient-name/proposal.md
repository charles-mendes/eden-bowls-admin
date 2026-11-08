# Proposal

## Why

Na segunda caminhada com um operador do Brasil (08/11/2026), três pedidos prontos ficaram parados com "Travado: Falta o nome de quem recebe". O painel só oferece "Ver na entrega", e lá a linha também não deixa fazer nada: hoje a regra é não editar o endereço por ali. O operador espera o cliente mesmo quando sabe o nome (titular da conta ou combinado por WhatsApp).

A fila também mostra o e-mail quando falta o nome de quem recebe. Com vários pedidos do mesmo cliente, o operador separa os pedidos pela data e pelos sabores.

A change irmã `operator-fills-recipient-name` em `eden-bowls-backend` cria a rota e os campos que esta usa.

## What Changes

- **"Informar quem recebe" na trava.** Onde a trava diz "Falta o nome de quem recebe", o painel oferece "Informar quem recebe" a quem tem `users.delivery.write`. Isso vale na fila de produção (linha pronta), em Entregas Brasil (linhas de "A despachar" e "Falhas") e em "Entrega Brasil" no detalhe da assinatura.
  - Abre um diálogo com um só campo, já preenchido com `account_name` quando existir, e o texto "Fica só nesta assinatura. O nome da conta não muda."
  - Ao salvar, chama `PATCH /api/v1/admin/billing/subscriptions/:id/recipient-name` e recarrega a linha. Sem outra trava, a linha passa a oferecer "Expedir" ou "Despachar".
  - Erro 422 aparece no campo.
- **Exceção à regra de não editar o endereço:** só o nome de quem recebe. Número, CEP, rua e os outros campos continuam fora do alcance do painel nessas telas.
- **Nome na fila:** a fila mostra o nome que a API devolve (quem recebe, depois nome da conta, depois e-mail). A busca passa a achar também pelo nome da conta.
- **Sem mudança:** o diálogo de despacho, o "Marcar entregues" (a correção da hora é só na API) e as outras travas.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `operations/production-queue`: a linha pronta travada pelo nome oferece "Informar quem recebe"; a busca acha pelo nome da conta.
- `operations/courier-deliveries`: a linha travada pelo nome oferece "Informar quem recebe"; o resto do endereço continua sem edição.
- `operations/subscription-detail`: "Entrega Brasil" travada pelo nome oferece "Informar quem recebe".

## Impact

- Componente novo de diálogo (`src/components/shipping/RecipientNameDialog.tsx` ou parecido) e uma função em `src/lib/` para a rota.
- `src/pages/ProductionQueuePage.tsx`, `src/pages/CourierDeliveriesPage.tsx`, `src/pages/SubscriptionDetailPage.tsx`.
- `src/test/mockAdminFetch.ts`: rota nova e `account_name`.
- `npm run contract:sync` depois do manifesto do backend; commit de `contracts/backend-routes.json`.
- Testes das três páginas e do diálogo.
