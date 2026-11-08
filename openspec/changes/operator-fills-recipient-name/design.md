# Design

## Context

As três telas já mostram a trava com `issueCodeText` (fila: `courierIssues`; Entregas Brasil: `issues`; detalhe: `courier_issues`). O backend passa a aceitar o nome de quem recebe por uma rota estreita e a mandar `account_name` em cada item.

## Goals / Non-Goals

**Goals:**
- Destravar pelo nome na tela onde a trava aparece, com um diálogo de um campo.
- Uma só implementação do diálogo nas três telas.

**Non-Goals:**
- Editar outros campos do endereço pelo painel.
- Destravar sozinho com o nome da conta.

## Decisions

- **Um diálogo compartilhado.** Recebe a assinatura, a sugestão e um `onSaved`. Usa o `Dialog` do painel, um campo "Nome de quem recebe", o texto de ajuda e o botão "Salvar nome".
- **Só para `recipient_name_missing`.** O botão aparece quando esse código está na lista e o usuário tem `users.delivery.write`. Com outros códigos junto, o botão aparece e a linha continua travada pelos outros depois de salvar.
- **Sugestão, não preenchimento automático silencioso.** O campo vem com `account_name`, mas o operador precisa clicar "Salvar nome". Sem `account_name`, o campo vem vazio.
- **Depois de salvar, recarregar a lista da tela.** A fila recarrega a página atual, Entregas Brasil recarrega a aba, o detalhe recarrega a assinatura. Mais simples que remendar o item com `courier_issues` da resposta, e a resposta é usada só para a mensagem de status.

## Risks / Trade-offs

- [Operador aceita a sugestão sem pensar] → o texto de ajuda diz que é o nome de quem recebe a caixa; a auditoria guarda quem gravou.
- [Operador sem a permissão vê a trava sem saída] → continua o "Ver na entrega"/contato como hoje.
