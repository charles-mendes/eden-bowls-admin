# Tasks

## 1. Oferta de criar receita no diálogo

- [x] 1.1 Em `ProductDetailPage.tsx`, calcular a chave candidata na ordem do design: a `recipeKey` gravada e não registrada, depois o slug do sabor, depois `recipeKeyFromName(flavor)`. Mostrar **Criar receita `<chave>`** abaixo do campo **Receita (conteúdo)** quando a candidata não é uma receita do mercado. Verificar com testes em `ProductDetailPage.test.tsx`:
  - aparece para o sabor novo e para a variação salva sem receita;
  - para a `recipeKey` gravada e não registrada, oferece essa chave, e não o slug;
  - não aparece com a receita registrada nem com a candidata vazia.
- [x] 1.2 Tirar o link "Cadastre em Receitas" da dica do campo e ajustar o teste `offers only the recipes registered in the market, with a link to register more`. Verificar com `npx vitest run src/pages/ProductDetailPage.test.tsx`.

## 2. Cadastro e seleção

- [x] 2.1 Implementar o bloco embutido com nome, chave e fase pré-preenchidos e o aviso de que a receita fica mesmo sem salvar a variação. Os botões são `type="button"`, e Enter nos campos do bloco cadastra a receita em vez de submeter o formulário da variação. **Cadastrar e vincular** chama `POST /admin/catalog/recipe-content?market=<data.planCountry>`. Verificar com testes:
  - o corpo é `{ key, name, lifeStage }`;
  - a receita fica selecionada e nenhum PATCH do produto é enviado;
  - Enter no nome da receita manda o POST e não o PATCH;
  - um rascunho gravado como BR, com o país mudado para US na tela, cadastra em BR.
- [x] 2.2 Após o cadastro, acrescentar a receita a `marketRecipes` e passar a chave por `updateDialogDraft`, para a fase seguir a receita. Verificar com testes: salvar o diálogo envia a `recipeKey` da nova receita; uma receita Filhote trava a fase em Filhote.
- [x] 2.3 Cancelar o diálogo depois do cadastro não envia PATCH do produto nem DELETE da receita. Verificar com teste que conta as chamadas no mock.

## 3. Falhas

- [x] 3.1 Mostrar os erros do cadastro dentro do diálogo com `recipeContentFailure`, mantendo os campos da variação. Para `recipe_key_taken`, recarregar as receitas do mercado e selecionar a existente. Verificar com testes para `recipe_key_invalid` e `recipe_key_taken`.

## 4. Verificação

- [x] 4.1 Rodar `npx vitest run src/pages/ProductDetailPage.test.tsx src/pages/RecipesPage.test.tsx`, depois `npm run lint` e `npx tsc -b`.
- [x] 4.2 Tirar captura com Playwright do diálogo com o bloco aberto, a 1280 px e a 390 px de largura. Conferir que cabe nos 520 px do painel sem rolagem horizontal. Apagar a página temporária depois.
- [ ] 4.3 Antes de `openspec archive`, confirmar que `add-recipe-image-and-label` já foi arquivado. Verificar com `openspec validate create-recipe-from-variation-dialog --strict` sem o aviso "Archive would refuse this delta".
