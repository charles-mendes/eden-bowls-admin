# Proposal

## Why

Uma variação só ativa quando a receita tem foto, apresentação e, nos EUA, rótulo completo. Esse conteúdo só pode ser editado na página da receita, `/catalog/recipes/:market/:recipeKey`. Quem cadastra um sabor no detalhe do produto vê "Pendente: foto, apresentação", sai para a página da receita, preenche e volta para ativar. Depois de `create-recipe-from-variation-dialog`, cadastrar a receita já não exige sair do produto, mas preenchê-la ainda exige. É nesse preenchimento que está o volume do trabalho.

## What Changes

- **Painel lateral de conteúdo da receita no detalhe do produto.**
  - Na coluna **Conteúdo** da tabela de variações, o link **Conteúdo** passa a abrir um painel lateral largo sobre a página.
  - O painel tem as mesmas seções editáveis da página da receita: fase da vida, apresentação na loja, imagem da tela inicial, miniatura do plano e rótulo.
  - Renomear e excluir a receita continuam só na página da receita. O painel tem um link **Abrir página da receita**.
- **Aviso de conteúdo compartilhado no topo do painel.** O topo diz que o conteúdo vale para todas as variações do mercado com aquela chave e lista essas variações com o produto de cada uma, incluindo as de outros produtos. O aviso também cobre a fase da vida: mudar a fase altera todas essas variações.
- **Volta ao produto atualizada.** Cada gravação no painel e o fechamento do painel recarregam o produto. Assim, os selos de imagem e rótulo, a fase travada e a lista de pendências refletem o que foi salvo.
- **Pendências da receita viram links.** Na coluna **Situação**, os itens "foto", "rótulo" e "apresentação" de uma variação com receita abrem o painel já rolado até a seção que falta. Preço, Stripe e NCM continuam como texto, porque se resolvem no diálogo da variação.
- **Seções endereçáveis.** Cada seção do conteúdo ganha uma âncora estável: `#fase`, `#apresentacao`, `#imagem`, `#miniatura` e `#rotulo`. A página da receita rola até a seção quando a URL traz a âncora, e o painel usa as mesmas âncoras.
- **Alterações não salvas.** Fechar o painel com apresentação ou rótulo alterados e não salvos pede confirmação.

## Capabilities

### New Capabilities

_Nenhuma._

### Modified Capabilities

- `operations/catalog-products`:
  - o detalhe do produto edita o conteúdo da receita da variação num painel lateral, no mercado gravado do produto;
  - as pendências da receita viram atalhos para esse painel;
  - os textos que mandavam para a página da receita apontam para o painel;
  - "Unsaved plan fields are visible" (MODIFIED): a recarga depois de salvar no painel preserva país, duração e limite alterados e não salvos.
- `operations/catalog-recipe-content`:
  - as seções do conteúdo têm âncoras, e a página da receita abre na seção indicada pela URL;
  - "Variation opens its recipe content page" (MODIFIED): a linha abre o painel, e o link para a página passa para dentro dele. Esse requisito vem de `add-recipe-image-and-label`, que precisa ser arquivado antes deste change.

## Impact

- Novo componente de painel lateral em `src/components/`, com o mesmo controle de foco e de Escape do `Dialog`, e estilos em `src/index.css`.
- Extração de `RecipeContentPage.tsx` para componentes reaproveitáveis: fase da vida, imagem da tela inicial e rótulo (com `ListEditor` e `ParagraphsEditor`). Eles se juntam aos já existentes `RecipePresentationSection` e `RecipePlanImageSection`. A página da receita passa a montar esses componentes, sem mudar o comportamento.
- `src/pages/ProductDetailPage.tsx` (coluna Conteúdo, pendências, painel) e testes em `ProductDetailPage.test.tsx` e `RecipeContentPage.test.tsx`.
- API: só rotas já existentes em `contracts/backend-routes.json`. Sem mudança no backend.
- Depende de nada novo. Pode ser entregue antes ou depois de `create-recipe-from-variation-dialog`. A ordem recomendada é depois, porque é aquele change que leva o operador a receitas recém-criadas e vazias.
- Toca a mesma capability do change aberto `add-recipe-image-and-label` (18/19 tarefas, falta só a verificação em QA). Arquivar aquele change antes evita conflito nas specs.
