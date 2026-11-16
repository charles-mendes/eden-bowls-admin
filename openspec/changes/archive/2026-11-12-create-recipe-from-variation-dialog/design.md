# Design

## Context

O diálogo da variação em `ProductDetailPage.tsx` carrega `marketRecipes` com `GET /admin/catalog/recipe-content?market=<país>` e mostra o campo **Receita (conteúdo)** como um `<select>`. `updateDialogDraft` sugere a `recipeKey` a partir do slug do sabor. A sugestão vem de uma variação irmã com o mesmo slug ou do próprio slug, mas só vale se a chave estiver em `marketRecipes`. Sem isso, o campo fica em "Sem receita". Quando há receita ligada com `lifeStage`, a fase da variação segue a da receita e fica travada.

O `Dialog` não suporta outro diálogo empilhado. Ele prende o foco no próprio painel e fecha com Escape. A `RecipesPage` já cria receitas com `POST /admin/catalog/recipe-content?market=`, recebendo `{ key, name, lifeStage }`, e trata os erros com `recipeContentFailure`.

## Goals / Non-Goals

**Goals:**
- Cadastrar a receita sem sair do diálogo e sem perder o que foi digitado na variação.
- Manter o mesmo vínculo de hoje: a variação só grava a `recipeKey` ao salvar.

**Non-Goals:**
- Preencher imagem, rótulo ou apresentação a partir do produto. Isso fica no change `edit-recipe-content-from-product`.
- Apagar a receita quando o diálogo é cancelado. É a opção (a): a sobra é aceita.
- Mudanças na API.

## Decisions

**1. Formulário embutido no campo, não um segundo diálogo.**
O botão **Criar receita `<chave>`** expande um bloco abaixo do `<select>`, dentro do mesmo `dialog-body`. O bloco tem nome, chave, fase e os botões **Cadastrar e vincular** e **Cancelar**.
- Alternativa descartada: um diálogo empilhado. Exigiria mudar o controle de foco e de Escape do `Dialog`, e o Escape fecharia os dois diálogos.
- Alternativa descartada: criar com um clique só, sem formulário. A chave e a fase são imutáveis ou têm efeito amplo (a fase reescreve todas as variações ligadas). O operador precisa vê-las antes de confirmar.

**1b. O bloco vive dentro do `<form>` da variação.**
O `submit` desse formulário salva a variação. Por isso:
- **Cadastrar e vincular** e **Cancelar** do bloco são `type="button"`.
- Os campos do bloco tratam Enter com `preventDefault` e disparam o cadastro da receita. Sem isso, Enter no nome da receita gravaria a variação.

Um `<form>` aninhado não é HTML válido, por isso o bloco não tem formulário próprio.

**2. Quando a oferta aparece.**
A chave candidata segue esta ordem, a mesma da spec:
1. A `recipeKey` gravada na variação, quando não está em `marketRecipes`. É o caso `recipe_not_registered`, e a chave gravada pode ser diferente do slug.
2. Senão, `draft.flavorSlug.trim()`.
3. Senão, `recipeKeyFromName(draft.flavor)`.

A oferta aparece quando há candidata e ela não é uma receita do mercado. A regra vale para variação nova e para variação salva. `suggestFlavorSlug` e `recipeKeyFromName` geram a mesma chave para o mesmo texto, e é isso que mantém coerente a sugestão de slug e a de receita.

**2b. Mercado do cadastro: o país gravado no produto.**
O `POST` usa `data.planCountry`, não o `planCountry` do select do Plano, que pode estar alterado e não salvo num rascunho. `marketRecipes` já é carregado de `data.planCountry`, então a lista e o cadastro ficam no mesmo mercado.

**3. Valores iniciais.**
- Nome: o sabor; sem sabor, o nome da variação.
- Chave: a candidata, editável e passando por `recipeKeyFromName` ao digitar no nome enquanto a chave não foi tocada. É o mesmo comportamento da `RecipesPage`.
- Fase: a `lifeStage` atual do rascunho.

A validação fica com a API, e a mensagem vem de `recipeContentFailure`.

**4. Depois do cadastro.**
- A receita retornada entra em `marketRecipes`.
- O rascunho passa por `updateDialogDraft({ recipeKey: created.flavorSlug })`. Isso marca `recipeKeyTouched` e aplica a fase da receita pela regra que já existe.
- O bloco fecha e o diálogo mostra uma nota de sucesso: "Receita cadastrada. Salve a variação para vincular. Imagem, rótulo e apresentação são cadastrados na página da receita."
- Nenhum PATCH do produto é enviado nesse momento.

**5. Chave já cadastrada (`recipe_key_taken`).**
O painel chama `loadMarketRecipes` de novo. Se a chave aparecer na lista, ele a seleciona e informa "A receita já existia e foi selecionada". Se não aparecer, o que só acontece em caso de corrida, mostra a mensagem padrão.

**6. Sobra aceita.**
Fechar ou cancelar o diálogo não desfaz o cadastro. O bloco avisa antes de confirmar: "A receita é cadastrada agora e continua em Receitas mesmo que você não salve a variação." A limpeza já existe: **Excluir receita** aparece na página da receita quando não há variações.

**7. Dica do campo.**
O link "Cadastre em Receitas" sai da dica. Ele navegava para fora e descartava o diálogo. A frase sobre o compartilhamento da imagem e do rótulo fica.

**8. Ordem de arquivamento.**
Os deltas têm `MODIFIED` de "Variation dialog sets the recipe key". Esse requisito só entra na spec principal quando `add-recipe-image-and-label` for arquivado, e `openspec archive` recusa este change antes disso. A nota de sucesso cita "a página da receita". O change `edit-recipe-content-from-product` troca esse texto quando o painel lateral existir.

## Risks / Trade-offs

- [Receitas órfãs se acumulam na lista] → O aviso antes do cadastro e a exclusão já disponível. A lista mostra "0/0" na coluna Variações, o que facilita achar as órfãs.
- [Chave errada fica gravada para sempre (é imutável)] → O formulário mostra a chave antes de confirmar, com a mesma dica de formato da `RecipesPage`. Uma chave errada sem variações pode ser excluída.
- [Fase escolhida no formulário trava a fase da variação] → É o comportamento já especificado para receitas ligadas. O formulário parte da fase atual da variação, então o padrão não muda nada.
