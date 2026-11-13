# Tasks

## 1. Extrair as seções da página da receita

- [x] 1.1 Mover `ListEditor` e `ParagraphsEditor` de `RecipeContentPage.tsx` para um arquivo em `src/components/`. Verificar com `npx vitest run src/pages/RecipeContentPage.test.tsx` passando sem mudar asserções.
- [x] 1.2 Extrair `RecipeLifeStageSection`, `RecipeImageSection` e `RecipeLabelSection`, com a interface `{ token, market, recipeKey, content, canWrite, onSaved }`, e montá-las na página. Verificar com `RecipeContentPage.test.tsx` passando sem mudar asserções e com `npx tsc -b`.
- [x] 1.3 Dar às cinco seções os ids `fase`, `apresentacao`, `imagem`, `miniatura` e `rotulo`. Fazer a página rolar até a seção do `location.hash` depois que o conteúdo carrega. Verificar com testes novos em `RecipeContentPage.test.tsx`: `#rotulo` chama `scrollIntoView` no rótulo, e um hash desconhecido não rola.
- [x] 1.4 Acrescentar `onDirtyChange` à apresentação, ao rótulo, à imagem e à miniatura. A fase fica de fora. Verificar com testes de componente: digitar marca como sujo, salvar ou descartar desmarca, e escolher um arquivo marca a imagem.

## 2. Painel lateral

- [x] 2.1 Extrair do `Dialog` o hook de foco e Escape, com a opção `trapTab`. Criar o `Drawer`: lateral direita, largura `min(960px, 100%)`, cabeçalho fixo, corpo com rolagem, `onRequestClose` e `trapTab` ligado. Verificar com os testes existentes que usam `Dialog`, sem mudança, e com testes novos do `Drawer`: foco inicial, Escape, devolução do foco, e Tab no último controle voltando ao primeiro.
- [x] 2.2 Tirar captura com Playwright do `Drawer` com o rótulo aberto, a 1440 px e a 390 px, numa página temporária que importa `src/index.css`. Conferir que não há rolagem horizontal e que os estilos globais de `table` não vazam. Apagar a página temporária depois.

## 3. Conteúdo da receita no detalhe do produto

- [x] 3.1 Na coluna Conteúdo de `ProductDetailPage.tsx`, trocar o `Link` por um botão que abre o painel com a receita da variação, carregada por `GET recipe-content/:key?market=<data.planCountry>`. O painel mostra as cinco seções, o link para a página da receita e nenhuma ação de renomear ou excluir. Verificar com testes em `ProductDetailPage.test.tsx`:
  - escritor e `readonly`;
  - rascunho gravado como BR com o país mudado para US na tela, que carrega e grava em BR.

  Ajustar o teste `shows the stored image state and links each variation to its recipe content`.
- [x] 3.2 Mostrar no topo do painel o aviso de conteúdo compartilhado: a contagem, as variações, o produto de cada uma e a frase sobre a fase. Verificar com teste de uma receita ligada a variações de dois produtos.
- [x] 3.3 Recarregar o produto a cada `onSaved` e ao fechar, com `keepPlanFields` quando o Plano está alterado. Depois de salvar a fase, recarregar também `marketRecipes`. Verificar com testes:
  - salvar a imagem tira "foto" das pendências;
  - salvar a fase Filhote muda a linha das variações;
  - num rascunho, a duração 15 digitada e não salva continua depois de salvar no painel;
  - num produto publicado, o limite 6 digitado e não salvo continua depois de salvar no painel, com o aviso.
- [x] 3.4 Confirmar o fechamento (botão, Escape, clique fora) quando alguma seção estiver suja. Verificar com testes:
  - recusar mantém o painel e o texto;
  - fechar sem alterações não pergunta;
  - mudar a fase sem salvar e fechar não pergunta.

## 4. Pendências e textos

- [x] 4.1 Fazer `pendingItems` devolver `{ text, section? }` e mostrar "foto", "rótulo" e "apresentação" como botões que abrem o painel na seção (`imagem`, `rotulo`, `apresentacao`) quando a variação tem receita. Verificar com testes: "apresentação" abre o painel e rola até a apresentação; "preço" continua texto; uma variação sem receita não tem atalhos.
- [x] 4.2 Trocar os textos que mandam para a página da receita:
  - a dica da fase travada no diálogo, que ganha **Editar fase**: fecha o diálogo e abre o painel em `#fase`;
  - a nota de sucesso do cadastro de receita no diálogo;
  - `MISSING_LABELS` de `label_data` e `presentation`.

  Verificar com testes do botão **Editar fase** e da mensagem de recusa sem "na página da receita".

## 5. Verificação

- [x] 5.1 Rodar `npx vitest run src/pages/ProductDetailPage.test.tsx src/pages/RecipeContentPage.test.tsx src/pages/RecipesPage.test.tsx`, depois `npx vitest run --changed`, `npm run lint` e `npx tsc -b`.
- [x] 5.2 Tirar captura com Playwright do detalhe de um produto com o painel aberto por um atalho de pendência. Conferir a rolagem até a seção e o aviso de conteúdo compartilhado no topo.
- [x] 5.3 Antes de `openspec archive`, confirmar que `add-recipe-image-and-label` já foi arquivado. Verificar com `openspec validate edit-recipe-content-from-product --strict` sem o aviso "Archive would refuse this delta".
