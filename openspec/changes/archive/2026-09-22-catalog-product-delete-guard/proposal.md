# Proposal

## Why

Excluir um produto do catálogo apaga o cadastro mesmo quando uma assinatura já usa a variação ou o price. Não há foreign key: o vínculo é o `stripe_price_id` da assinatura e o JSON `plan_selection`. Trocar o rótulo do botão para Desativar, como o QA pediu, continuaria apagando o registro.

## What Changes

- **Excluir** só quando a API diz `canDelete`. Produto publicado com vínculo mostra **Desativar** (o rascunho que já existe) e não mostra Excluir.
- Produto em rascunho com vínculo não tem ação destrutiva. Variação vinculada perde o Excluir; a irmã sem vínculo continua excluível. Variação não ganha Desativar.
- **Voltar para rascunho** no detalhe passa a se chamar **Desativar** e continua o mesmo `PATCH { active: false }`.
- Um DELETE que volta `409` (`product_in_use` ou `variation_in_use`) mostra mensagem específica e refaz o GET. O `apiRequest` passa a expor status e `details.code`.
- O contrato novo (`canDelete`, 409, 502 se o archive na Stripe falhar) é a change irmã no backend, com o mesmo nome. Sem ela o painel não tem o que obedecer.

## Capabilities

### New Capabilities

- (nenhuma)

### Modified Capabilities

- `operations/catalog-products`: Excluir deixa de aparecer para todo `catalog.write`. A ação passa a depender de `canDelete` e de `active`. O botão de tirar do ar no detalhe muda de nome. Entram o texto de variação em uso e o tratamento do 409.

## Impact

- **Painel (este repo):** `ProductsPage`, `ProductDetailPage`, `api.ts` e os Vitest dessas páginas. O badge Publicado/Rascunho não muda.
- **Backend (`eden-bowls-backend`, change irmã `catalog-product-delete-guard`):** `canDelete` no GET de lista e detalhe; `DELETE` responde 409 antes de arquivar na Stripe; archive que falha não apaga o cadastro (502). Sem tarefa de backend neste repo.
- **Loja (`eden-bowls`):** sem impacto e sem tarefa. `GET /api/v1/products` já devolve só `post_status = publish`, e Desativar é o rascunho que essa lista já omite. Checkout que já guardou `variation_id` continua resolvendo o price no postmeta sem olhar o status — comportamento atual de “Voltar para rascunho”, fora deste escopo.
