# Verificação ponta a ponta (task 9.1)

5 de outubro de 2026, MySQL local (`127.0.0.1:3310`) e Stripe em modo de teste (chave US `sk_test_`), webhooks pelo `stripe listen`. O job de sincronização foi rodado à mão, um ciclo por vez.

| Passo | Resultado |
|---|---|
| Assinatura US criada pelo checkout com o cartão 4242 e posta em trial pelo "pular entrega" | ✓ `trial_end` em 07/12/2026 00:00 de Nova York; ledger atualizado pelo webhook |
| Fechamento pontual em 07/12: prévia e criação | ✓ 1 assinatura afetada, `stripe_sync`, alvo em 08/12 00:00 |
| Ciclo do job | ✓ Stripe em 08/12, sincronização `synced`, `current_period_end` do ledger atualizado por `customer.subscription.updated`, evento no histórico, Meu Plano com a nova data |
| Remoção do fechamento | ✓ data aberta; `trial_end` e a data remarcada continuam como estavam |
| `trial_end` mudado direto no Stripe depois de um fechamento novo | ✓ o job marca `conflict` com o valor encontrado e não grava |
| Reenvio e ciclo | ✓ volta para `pending`, o ciclo grava o alvo com chave nova (`delivery-calendar-sync:<id>:<tentativas>:<next_attempt_at>`), auditoria `delivery_calendar.sync_resend` com status anterior e valores esperado, encontrado e alvo |

Achados no caminho, corrigidos em commits próprios:
- O cliente Stripe não registrava o erro original de `customers.update` (`fix(stripe): log original Stripe error on customer update failure`).
- `attachPaymentMethod` devolvia o id enviado, e não o anexado (`fix(stripe): use attached payment method id returned by Stripe`).
- Uma linha cujo resultado não pudesse ser gravado interrompia o resto do ciclo, e a chave de idempotência era a mesma em retentativas e reenvios (`fix(delivery): isolate each calendar sync row and use a key per attempt`).

Uma execução do ciclo, logo após o primeiro reenvio, terminou com uma exceção não capturada no processo de teste. A mensagem se perdeu e a falha não se repetiu na nova rodada, que capturava `uncaughtException` e `unhandledRejection`.

Mudar o `trial_end` gera faturas `subscription_update` de US$ 0. Elas não contam como entrega.
