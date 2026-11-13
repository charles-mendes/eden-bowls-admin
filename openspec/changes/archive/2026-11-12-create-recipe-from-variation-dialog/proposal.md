# Proposal

## Why

Para vincular uma variação a uma receita, a receita precisa existir antes. O campo **Receita (conteúdo)** do diálogo da variação só oferece as receitas já cadastradas no mercado. Quando o sabor é novo, o operador fecha o diálogo, vai a Receitas, cadastra, volta ao produto e abre a variação de novo. A ordem obrigatória Receitas → Produtos é o primeiro atrito do cadastro de um sabor.

## What Changes

- No diálogo da variação, quando a chave sugerida para a variação (o slug do sabor) não é uma receita do mercado, o campo **Receita (conteúdo)** oferece **Criar receita `<chave>`**.
- A ação abre, dentro do próprio diálogo, um formulário curto com nome, chave e fase da vida, já preenchidos a partir do sabor, do slug e da fase da variação. **Cadastrar e vincular** chama `POST /api/v1/admin/catalog/recipe-content?market=<país do plano>`, acrescenta a receita à lista de escolha e a seleciona na variação. A variação só grava o vínculo quando o operador salva o diálogo, como hoje.
- **A receita nasce no ato.** Cancelar o diálogo da variação não apaga a receita criada. Ela fica na lista de Receitas, sem variações, onde já pode ser excluída. O formulário avisa isso antes do cadastro.
- Se a chave já existir no mercado (`recipe_key_taken`, por exemplo cadastrada em outra aba), o painel recarrega as receitas do mercado e seleciona a existente, em vez de só mostrar erro.
- A dica do campo deixa de mandar o operador para Receitas, que fazia perder o diálogo. Passa a dizer que imagem, rótulo e apresentação são cadastrados na página da receita.
- Fora do escopo: o preenchimento do conteúdo (imagem, rótulo, apresentação) a partir do produto. Isso é o change `edit-recipe-content-from-product`. Depois deste change, a variação continua sem ativar até a receita ter o conteúdo exigido.

## Capabilities

### New Capabilities

_Nenhuma._

### Modified Capabilities

- `operations/catalog-products`: o diálogo da variação cadastra uma receita nova no mercado gravado do produto e a seleciona no campo **Receita (conteúdo)**. Cancelar o diálogo continua sem PATCH, mas deixa a receita já cadastrada (MODIFIED de "Variation dialog saves one variation").
- `operations/catalog-recipe-content`: a dica do campo **Receita (conteúdo)** deixa de linkar para Receitas, e o cadastro passa a ser oferecido no próprio diálogo (MODIFIED de "Variation dialog sets the recipe key"). Esse requisito vem do change `add-recipe-image-and-label`, que precisa ser arquivado antes deste.

## Impact

- `src/pages/ProductDetailPage.tsx` (diálogo da variação, campo Receita) e `src/pages/ProductDetailPage.test.tsx`.
- Reaproveita `recipeKeyFromName`, `recipeContentFailure` e `LIFE_STAGE_LABELS` de `src/lib/recipeContent.ts`.
- API: só rotas já existentes no contrato (`POST` e `GET /admin/catalog/recipe-content`). Sem mudança no backend, em `contracts/backend-routes.json` ou no manifesto de rotas.
- Permissão: só quem tem `catalog.write`, que já é a condição para abrir o diálogo.
