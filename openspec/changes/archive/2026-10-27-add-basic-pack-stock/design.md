# Design

## Context

Ver `proposal.md` para o motivo. O contrato vem do change da API (`eden-bowls-backend/openspec/changes/add-basic-pack-stock`): `GET /admin/stock`, `GET /admin/stock/movements`, `POST /admin/stock/production`, `POST /admin/stock/adjustments`, `PUT /admin/stock/minimum`, o campo `stockCoverage` em cada item da fila e o objeto `stock` na resposta do `PATCH /admin/production/queue/:id`. As permissões são as da fila (`production.read` e `production.write`). O painel segue o padrão atual: página em `src/pages/`, HTTP por `apiRequest`, menu por papel em `src/lib/menu.ts` e o visual da skill `frontend-design`.

## Goals / Non-Goals

**Goals:**

- A cozinha abre uma tela e sabe o que produzir na janela.
- A fila mostra a cobertura sem mudar o fluxo de status.

**Non-Goals:**

- Edição em massa, importação de planilha e impressão de lista de produção.
- Bloquear a separação no painel.

## Decisions

1. **Rota `/operations/stock` no grupo Operação**, logo depois de "Fila de produção", com os mesmos papéis dela. O estoque é trabalho da mesma pessoa que opera a fila.
2. **`src/lib/packStock.ts`** concentra tipos, rótulos (tipos de movimento, motivos), formatação "receita tamanho" e a mensagem de cada código de erro (`stock_item_unknown`, `market_forbidden`, `invalid_window_days`). Segue o padrão de `productionQueue.ts`.
3. **Diálogos simples** para lançar, ajustar e definir mínimo, com estado local e `apiRequest`, sem biblioteca de formulário. No lançamento, receita e tamanho vêm da lista já carregada. Para uma receita sem linha na tabela, a pessoa digita a receita e escolhe o tamanho, e o 422 da API cobre o erro.
4. **Destaques com a cor semântica de aviso**, só em disponível negativo, abaixo do mínimo e no badge "Falta estoque". O resto segue os cinzas neutros do painel.
5. **Aviso de falta na fila** como alerta não bloqueante acima da tabela, fechável, preenchido pela resposta do `PATCH`. O aviso não pede confirmação antes de marcar como pronto, porque a API nunca bloqueia e confirmar a cada ciclo atrasaria a cozinha.
6. **Histórico abaixo da tabela**, na mesma página, paginado com o envelope compartilhado. Clicar numa linha da tabela filtra o histórico por aquele item.

## Risks / Trade-offs

- [O painel sai antes da API e chama rotas que ainda não existem] → `contract:sync` só roda com o manifesto da API publicada, e o teste de contrato falha antes.
- [A cobertura pode mudar entre carregar a fila e marcar como pronto] → O aviso usa a resposta do `PATCH`, que é o estado real depois da baixa.
