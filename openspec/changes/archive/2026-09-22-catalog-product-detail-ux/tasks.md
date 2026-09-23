# Tasks

Loja (`eden-bowls`) e backend (`eden-bowls-backend`) não entram nesta mudança. O contrato de `/api/v1/admin/catalog/products` permanece, e a loja não renderiza essas telas. Não criar tarefa nem editar arquivo nesses dois repositórios.

## 1. Guard de loading no detalhe

- [x] 1.1 Em `ProductDetailPage`, não renderizar Salvar, Publicar, Voltar para rascunho, Sincronizar Stripe nem Excluir produto enquanto o GET do produto não resolveu. Verificar com um teste em que o GET fica pendente: esses controles estão ausentes e nenhum PATCH sai.
- [x] 1.2 Manter o gate de permissão depois do load: `catalog.write` vê salvar, publicar e excluir; `catalog.sync` vê sincronizar; só `catalog.read` não vê nenhum. Salvar continua desabilitado com o produto publicado. Verificar que o teste `hides catalog mutations from readonly accounts` continua passando e que um publish com o produto já carregado envia o plano e as variações carregados.

## 2. Lista de produtos

- [x] 2.1 Mostrar a coluna de ações para toda sessão que abre a lista, com **Detalhes** (`ghost-button` para `/catalog/products/:id`) e o link do nome preservado. **Excluir** só com `catalog.write`. Verificar no Vitest de `ProductsPage` o `href` de Detalhes para `catalog.read` e para `catalog.write`, e que o leitor não vê Excluir.
- [x] 2.2 Trocar a coluna Ativo / Sim / Não pelo badge **Publicado** ou **Rascunho**, o mesmo rótulo do detalhe. Verificar que a lista não mostra mais Sim/Não nesse status.
- [x] 2.3 Ajustar o texto dos filtros para não dizer que a lista abre sem filtro quando o mercado da sessão já vem aplicado. Verificar na página renderizada que o texto novo está visível.

## 3. Detalhe: leitura, dias e mercado

- [x] 3.1 Colocar **Voltar** para `/catalog/products` nas ações da página e subir Publicação e sync para antes da tabela de variações. Mostrar o badge Publicado/Rascunho no topo. Verificar que Voltar aponta para a lista e que os controles de publicação aparecem antes da tabela.
- [x] 3.2 Quando `planDays` for nulo, deixar a duração vazia e omitir `28` e `0` do PATCH. Quando o produto já tiver dias, manter esse número. Verificar os dois casos no teste do detalhe.
- [x] 3.3 Limitar o select de país do detalhe a `sessionMarkets`. Verificar que `operatorWriteUser` (só BR) não tem a opção US e que `adminUser` tem BR e US.
- [x] 3.4 Traduzir o status da variação (`synced`, `not_synced`, `price_mismatch`, e a indicação de que precisa sincronizar), o alerta de publish bloqueado (nome ou SKU, não o id cru) e o retorno do sync (quantos preços foram criados e atualizados). Verificar o rótulo em português no teste do detalhe.

## 4. Verificação

- [x] 4.1 Rodar só o Vitest relacionado de `ProductsPage.tsx` e `ProductDetailPage.tsx` e confirmar que os casos novos e os PATCH já existentes passam.
