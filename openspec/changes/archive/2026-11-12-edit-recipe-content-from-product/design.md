# Design

## Context

`RecipeContentPage.tsx` tem cerca de 690 linhas. Duas seções já são componentes com a interface `{ token, market, recipeKey, content, canWrite, onSaved }`: `RecipePresentationSection` e `RecipePlanImageSection`. As outras três estão escritas direto na página: fase da vida, imagem da tela inicial e rótulo. O rótulo tem doze campos simples, linhas de níveis de garantia, a lista de ingredientes com "Colar lista" e três listas de parágrafos (`ListEditor` e `ParagraphsEditor` são locais da página).

`Section` já aceita `id`, mas nenhuma seção de conteúdo usa. O `Dialog` tem largura máxima de 520 px (`.dialog-panel` em `index.css`), prende o foco, fecha com Escape e com clique fora. O `GET /admin/catalog/recipe-content/:key?market=` devolve `variations` com `productId` e `productName`, que é o que o aviso de conteúdo compartilhado precisa.

Em `ProductDetailPage.tsx`, `pendingItems` devolve rótulos em texto ("foto", "rótulo", "apresentação"…). A coluna Conteúdo mostra um `Link` para `recipePagePath`. Recarregar o produto (`load` → `applyProduct`) refaz os rascunhos das variações. Isso só é seguro sem o diálogo da variação aberto, e o painel e o diálogo nunca ficam abertos juntos.

## Goals / Non-Goals

**Goals:**
- Uma só implementação de cada seção, usada pela página da receita e pelo painel.
- O painel é largo o bastante para o rótulo. Se não for, a página da receita continua sendo o editor de verdade.
- Ao voltar ao produto, as pendências refletem o que foi salvo, sem F5.

**Non-Goals:**
- Renomear ou excluir a receita pelo painel.
- Vincular ou desvincular a variação pelo painel. Isso continua no diálogo da variação.
- Links nas mensagens de recusa de ativação (`recipe_publish_refused`). Só as pendências da linha viram atalhos.
- Aviso de saída (`beforeunload`) na página da receita.

## Decisions

**1. Componente `Drawer` à direita, com o comportamento de foco do `Dialog` e Tab preso.**
- A lógica de foco inicial, Escape e devolução do foco sai do `Dialog` para um hook (`useModalFocus`). `Dialog` e `Drawer` usam o mesmo hook.
- O `Dialog` hoje não prende o Tab. Com o painel aberto, o teclado chegaria aos campos do Plano por baixo dele. O hook ganha a opção `trapTab`: Tab no último controle volta ao primeiro, e Shift+Tab no primeiro vai ao último. O `Drawer` liga a opção, e o `Dialog` fica como está para não mudar o comportamento já especificado.
- Alternativa descartada: `inert` no resto da aplicação. Exige saber qual é o nó raiz fora do portal, e o overlay já bloqueia o mouse. Prender o Tab resolve o teclado com menos acoplamento.
- O `Drawer` ocupa a altura toda, tem largura `min(960px, 100%)`, cabeçalho fixo e corpo com rolagem própria. No celular, ocupa a largura toda.
- Alternativa descartada: dar uma prop de tamanho ao `Dialog`. Um modal centrado de 960 px esconde a tabela inteira. O painel lateral deixa a linha da variação visível em telas largas e rola melhor um formulário longo.
- Alternativa descartada: expandir a linha da tabela. O `index.css` tem estilos globais de `table` que já quebraram componentes, e um formulário de rótulo dentro de uma `<td>` herda tudo isso.

**2. Extrair as três seções que faltam.**
- Novos componentes: `RecipeLifeStageSection`, `RecipeImageSection` e `RecipeLabelSection`. `ListEditor` e `ParagraphsEditor` vão para um arquivo próprio, usado pelo rótulo.
- Os três usam a mesma interface das seções já existentes e recebem `id` para a âncora.
- `RecipeContentPage` passa a só montar as seções, o cabeçalho (renomear, excluir) e a lista de variações. Os testes atuais da página precisam passar sem mudança de comportamento. Eles são a rede de segurança da extração.

**3. Alterações não salvas viram um sinal de cada seção.**
- `RecipePresentationSection`, `RecipeLabelSection`, `RecipeImageSection` e `RecipePlanImageSection` ganham `onDirtyChange?(dirty)`.
- "Sujo" quer dizer: formulário diferente do conteúdo salvo, no caso da apresentação e do rótulo; arquivo escolhido e não enviado, no caso das imagens. A fase não conta, porque tem um botão próprio e um select só.
- O `Drawer` recebe um `onRequestClose`. O painel junta os sinais e confirma com `window.confirm`, o mesmo padrão das exclusões no painel.

**4. Conteúdo carregado pelo painel e recarga do produto.**
- Ao abrir, o painel busca `GET recipe-content/:key?market=<data.planCountry>`. O mercado é o país **gravado** no produto, nunca o `planCountry` do select, que pode estar alterado e não salvo. Como a recarga preserva o país alterado (decisão 4b), usar o valor da tela poderia gravar conteúdo no mercado errado.
- O `onSaved` de cada seção atualiza o conteúdo do painel e chama `load()` do produto. Ao fechar, `load()` roda de novo, para cobrir gravações com resposta perdida.
- Depois de salvar a fase, o painel também chama `loadMarketRecipes`, porque a fase travada no diálogo da variação vem de `marketRecipes`.

**4b. Recarga que preserva o Plano.**
- `applyProduct` sobrescreve país, duração e limite com o valor do servidor. A recarga vinda do painel usa uma variante (`applyProduct(product, { keepPlanFields: planDirty })`) que troca `data` e as variações. Quando há alteração não salva, ela mantém os três campos do Plano.
- Isso muda o requisito "Unsaved plan fields are visible" (MODIFIED no delta).
- Os testes cobrem os dois casos editáveis: a duração num rascunho e o limite do pacote pequeno num produto publicado. No publicado, país e duração ficam travados e só o limite (`limitDirty`) pode estar alterado.

**4c. Fase fora do "sujo".**
O select da fase só grava no botão **Salvar fase**. Fechar o painel depois de mudar o select descarta a escolha sem perguntar, como já acontece na página da receita. A spec registra isso num cenário.

**5. Âncoras com nomes estáveis em português.**
- Ids: `fase`, `apresentacao`, `imagem`, `miniatura` e `rotulo`, iguais na página e no painel. Não há colisão porque o painel só existe no detalhe do produto, onde esses ids não aparecem em outro lugar.
- Na página da receita, um efeito lê `location.hash` depois que o conteúdo carrega e chama `scrollIntoView` uma vez. Um hash desconhecido é ignorado.
- No painel, a seção alvo é passada como estado de abertura (`{ recipeKey, section }`), e o mesmo efeito rola dentro do corpo do painel.

**6. Pendências com a seção de destino.**
- `pendingItems` passa a devolver `{ text, section? }`: foto → `imagem`, rótulo → `rotulo`, apresentação → `apresentacao`. Preço, Stripe e NCM vêm sem seção.
- Só itens com seção e variação com `recipeKey` viram `<button className="link-button">`. O texto "Pendente: …" continua igual para leitores de tela, com cada item como um botão nomeado ("Abrir apresentação de <variação>").
- "foto" também pode ser satisfeita pela confirmação manual da variação. O atalho leva à imagem da receita, que é o caminho que dispensa essa confirmação.

**7. Coluna Conteúdo.**
- O `Link` **Conteúdo** vira um botão que abre o painel, para todos os papéis. Leitores veem o painel só em leitura.
- O link para a página da receita continua disponível dentro do painel.

**8. Textos que mandavam para a página da receita.**
Com o painel, estes textos passam a apontar para o conteúdo no próprio produto:
- A dica da fase travada no diálogo da variação ("edite a fase na página da receita") ganha o botão **Editar fase**, que fecha o diálogo e abre o painel em `#fase`.
- A nota de sucesso do cadastro de receita no diálogo, de `create-recipe-from-variation-dialog`.
- Os textos de `MISSING_LABELS` para `label_data` e `presentation`.

**9. Ordem de arquivamento.**
Os deltas têm `MODIFIED` de "Variation opens its recipe content page", que vem de `add-recipe-image-and-label`. `openspec archive` recusa este change antes daquele ser arquivado.

## Risks / Trade-offs

- [A extração quebra a página da receita] → A extração vai num grupo próprio, antes de qualquer mudança no produto, e o critério é `RecipeContentPage.test.tsx` passar sem editar asserções.
- [Editar no painel parece uma edição local do produto] → O aviso de conteúdo compartilhado fica no topo fixo do painel, com a contagem e os produtos, e repete o efeito da fase.
- [Recarga do produto apaga alterações não salvas do Plano] → Decisão 4b, com testes da duração no rascunho e do limite no publicado. O painel e o diálogo da variação nunca abrem juntos.
- [País alterado e não salvo leva o conteúdo ao mercado errado] → O painel usa sempre `data.planCountry` (decisão 4), com um teste.
- [jsdom não calcula layout, e o painel pode abrir quebrado] → A verificação inclui captura com Playwright em 1440 px e 390 px, com o rótulo aberto.
- [Recusas da API por variação ativa (`recipe_content_in_use`) aparecem dentro do painel] → As seções já tratam essas mensagens. O painel só as reaproveita.
