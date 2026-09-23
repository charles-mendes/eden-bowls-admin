# Tasks

Loja (`eden-bowls`) não entra nesta mudança. O catálogo público já lista só produto `publish`, e Desativar continua sendo o rascunho atual. Não criar tarefa nem editar arquivo nesse repositório.

Backend (`eden-bowls-backend`) também não se edita neste apply. O contrato (`canDelete`, 409, 502) é a change irmã `catalog-product-delete-guard` naquele repositório. Aplique essa change antes, ou no mesmo release.

## 1. Erro da API

- [x] 1.1 Em `src/lib/api.ts`, fazer o erro de `apiRequest` carregar `status` e `details.code` além da `message`. Quem só lê `message` continua igual. Verificar com um teste que um 409 `{ details: { code: 'product_in_use' } }` expõe esse código e o status, e que um erro sem body ainda tem mensagem.

## 2. Lista

- [x] 2.1 Em `ProductsPage`, mostrar **Excluir** só com `catalog.write` e `canDelete` true, com a confirmação atual. `canDelete` ausente conta como false. Verificar no Vitest da página que o escritor vê Excluir nesse caso e que o leitor não vê Excluir nem Desativar.
- [x] 2.2 Na mesma lista, produto publicado com `canDelete` false mostra **Desativar** e não mostra Excluir. Confirmar envia `PATCH { active: false }` e não envia DELETE. Verificar no Vitest o rótulo, o método e que o DELETE não sai.
- [x] 2.3 Produto em rascunho com `canDelete` false não mostra Excluir nem Desativar, e mostra que está vinculado a uma assinatura e não pode ser excluído. Verificar no Vitest a ausência dos dois botões e o texto.

## 3. Detalhe

- [x] 3.1 Em `ProductDetailPage`, trocar o rótulo **Voltar para rascunho** por **Desativar** no produto publicado, com o mesmo `PATCH { active: false }`. A confirmação diz que tira da loja e mantém o cadastro e a cobrança atual. **Excluir produto** só com `canDelete` true, depois do GET. Verificar no Vitest que o detalhe publicado e vinculado mostra Desativar, não mostra Excluir produto, e que o PATCH não inclui DELETE.
- [x] 3.2 Na tabela de variações, **Excluir** só na variação com `canDelete` true. A variação com `canDelete` false não tem Excluir nem Desativar e diz que está em uso numa assinatura. Verificar no Vitest um produto com as duas variações.
- [x] 3.3 No catch de Excluir (lista e detalhe), 409 `product_in_use` ou `variation_in_use` mostra que o produto já está em assinaturas e não pode ser excluído, e refaz o GET. 502 de archive mostra a falha e não remove a linha. Verificar no Vitest que o segundo GET acontece no 409 e que a linha permanece no 502.

## 4. Verificação

- [x] 4.1 Rodar só o Vitest relacionado de `src/lib/api.ts`, `src/pages/ProductsPage.tsx` e `src/pages/ProductDetailPage.tsx` e confirmar os casos acima.
