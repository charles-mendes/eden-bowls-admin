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
- **Sugestão por botão, campo vazio.** O campo abre vazio. Com `account_name`, um botão "Usar nome da conta (…)" preenche o campo, e o operador ainda clica "Salvar nome". A spec de quem recebe prevê presente (Ana compra, João recebe); o campo já preenchido levaria a gravar a Ana sem pensar. Custa um clique.
- **"(conta)" ao lado do nome.** Com `name_source: account`, o nome vem seguido de "(conta)" em texto apagado, para a linha não mostrar "Ana Costa" e "Falta o nome de quem recebe" como se fosse defeito.
- **Depois de salvar, recarregar a lista da tela.** A fila recarrega a página atual, Entregas Brasil recarrega a aba, o detalhe recarrega a assinatura. Mais simples que remendar o item com `courier_issues` da resposta, e a resposta é usada só para a mensagem de status.

## Risks / Trade-offs

- [Operador aceita a sugestão sem pensar] → campo vazio, botão explícito, texto pede confirmar presente com o cliente; a auditoria guarda quem gravou.
- [Operador sem a permissão vê a trava sem saída] → continua o "Ver na entrega"/contato como hoje.
