## 1. Diálogo e chamada

- [ ] 1.1 Função em `src/lib/` para `PATCH /api/v1/admin/billing/subscriptions/:id/recipient-name`, com erro 422 no campo `recipient_name`
- [ ] 1.2 Diálogo "Informar quem recebe" com campo sugerido por `account_name`, texto de ajuda e "Salvar nome"
- [ ] 1.3 Mock da rota e `account_name` em `src/test/mockAdminFetch.ts`; `npm run contract:sync` depois do manifesto do backend

## 2. Telas

- [ ] 2.1 Fila de produção: "Informar quem recebe" na linha pronta com `recipient_name_missing`, para quem tem `users.delivery.write`; recarrega depois de salvar
- [ ] 2.2 Entregas Brasil: o mesmo nas linhas de "A despachar" e "Falhas"
- [ ] 2.3 Detalhe da assinatura: o mesmo em "Entrega Brasil"

## 3. Testes

- [ ] 3.1 Diálogo: sugestão, salvar, erro 422
- [ ] 3.2 Uma linha travada só pelo nome vira "Expedir"/"Despachar" depois de salvar, nas três telas
- [ ] 3.3 Sem a permissão, nenhum botão; com outro código além do nome, a linha continua travada
