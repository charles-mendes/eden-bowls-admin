# Proposal

## Why

Na lista de produtos o único caminho para o detalhe é o nome em azul, e o QA não o encontrou: a coluna de ações só mostra Excluir. No detalhe, quem tem `catalog.write` vê Publicar antes do GET terminar; o clique trata o produto ainda vazio como rascunho e pode gravar país, dias e variações iniciais por cima do cadastro.

## What Changes

- A lista em `/catalog/products` ganha **Detalhes** ao lado de Excluir. O link do nome permanece. A coluna de ações fica visível para quem só lê.
- Listagem e detalhe usam o mesmo rótulo para `active` (status `publish`): **Publicado** ou **Rascunho**. Não há um segundo campo “ativo”.
- No detalhe, Salvar, Publicar, Sincronizar Stripe e Excluir produto só aparecem depois que o produto carregou. O payload de um publish com o produto já carregado não muda.
- O detalhe ganha Voltar, a seção de publicação sobe para antes da tabela de variações, e os textos de sync e de publish bloqueado passam a falar nome ou SKU, em português.
- Se `planDays` vier nulo, o campo fica vazio. Hoje a tela inventa 28 e um Salvar gravaria esse número.
- O select de país do detalhe passa a oferecer só os mercados da sessão. Operador só-BR não escolhe US; admin com BR e US continua vendo os dois. Isso fecha o buraco do select, que hoje lista os dois países para qualquer sessão. A criação de produto já segue a sessão.

## Capabilities

### New Capabilities

- `operations/catalog-products`: lista e detalhe de produto no painel — caminho explícito para o detalhe, um único rótulo de publicação, ações de escrita só depois do load, e dias do plano sem valor inventado.

### Modified Capabilities

- `operations/admin-market-scope`: o select de país no detalhe do produto passa a cumprir a regra já escrita de que controles de país do catálogo só oferecem mercados da sessão. O texto da requirement não muda; entra o cenário do detalhe.

## Impact

- Código: só `eden-bowls-admin` — `ProductsPage`, `ProductDetailPage` e os testes Vitest dessas páginas. Padrão visual já usado em feedbacks (`table-actions`, `ghost-button`, badges).
- API: nenhuma. `GET` / `POST` / `PATCH` / `DELETE` de `/api/v1/admin/catalog/products` permanecem. `planDays` nulo já é ignorado no patch (`planDays != null`). País continua `BR` ou `US`.
- Loja (`eden-bowls`): sem impacto e sem tarefa. Não renderiza essas telas nem lê os rótulos do painel. O que a loja consome continua sendo o produto publicado, pelo mesmo contrato.
- Backend (`eden-bowls-backend`): sem tarefa nesta mudança. `getProduct` já recusa produto fora do mercado do ator. O patch ainda aceita trocar `planCountry` para o outro país se o cliente mandar o valor; a trava nova é o select da sessão, como na criação. Fechar essa via na API fica fora do escopo.
