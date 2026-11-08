## 1. Diálogo e chamada

- [x] 1.1 Função em `src/lib/` para `PATCH /api/v1/admin/billing/subscriptions/:id/recipient-name`, com erro 422 no campo `recipient_name`
- [x] 1.2 Diálogo "Informar quem recebe" com campo vazio, botão "Usar nome da conta (…)" quando há `account_name`, texto de ajuda, "Salvar nome" e mensagem do 409
- [x] 1.3 "(conta)" apagado ao lado do nome quando a origem é a conta, na fila e em Entregas Brasil
- [x] 1.4 Mock da rota e `account_name` em `src/test/mockAdminFetch.ts`; `npm run contract:sync` depois do manifesto do backend

## 2. Telas

- [x] 2.1 Fila de produção: "Informar quem recebe" na linha pronta com `recipient_name_missing`, para quem tem `users.delivery.write`; recarrega depois de salvar
- [x] 2.2 Entregas Brasil: o mesmo nas linhas de "A despachar" e "Falhas"
- [x] 2.3 Detalhe da assinatura: o mesmo em "Entrega Brasil"

## 3. Testes

- [x] 3.1 Diálogo: botão da conta preenche sem salvar, salvar, erro 422, 409
- [x] 3.2 "(conta)" na fila e em Entregas Brasil
- [x] 3.3 Uma linha travada só pelo nome vira "Expedir"/"Despachar" depois de salvar, nas três telas
- [x] 3.4 Sem a permissão, nenhum botão; com outro código além do nome, a linha continua travada
