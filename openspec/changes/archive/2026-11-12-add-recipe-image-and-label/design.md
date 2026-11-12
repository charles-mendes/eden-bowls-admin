# Design

## Context

Motivação em `proposal.md`. O contrato (rotas, formato `{ mimeType, imageBase64 }`, `labelStatus`/`labelMissing`, `recipeImageUrl`/`recipeLabelStatus` no detalhe do produto, códigos 422/409) está no change irmão em `eden-bowls-backend` (`recipe-content`). No painel, o SPA usa `apiRequest`, sem biblioteca de formulário, e `src/lib/feedbacks.ts` já converte um `File` em base64. Cada sessão é limitada a mercados, e o mercado do produto é o seu `planCountry`.

## Goals / Non-Goals

**Goals:** cadastrar imagem e rótulo sem sair do catálogo, com o erro de tamanho pego antes do envio.

**Non-Goals:** regras de completude ou de tamanho próprias (a API decide); editar título, tagline e cores da receita.

## Decisions

### 1. Área de Receitas fora do produto

A receita é cadastrada por mercado e compartilhada entre produtos, então ela ganha um lugar próprio: o item **Receitas** no grupo Loja de `src/lib/menu.ts`, a lista `RecipesPage.tsx` em `/catalog/recipes` e a página `RecipeContentPage.tsx` em `/catalog/recipes/:market/:recipeKey`. A primeira versão abria a página dentro do produto (`/catalog/products/:productId/recipes/:recipeKey`), o que deixava a receita sem lugar quando nenhuma variação a usava e escondia as receitas sem conteúdo. Essa rota sai: ainda não foi publicada.

- A lista lê `GET /admin/catalog/recipe-content?market=` e filtra no navegador ("Sem imagem", "Rótulo incompleto"). O mercado segue o filtro de Produtos (`sessionMarkets`).
- **Nova receita** é um `Dialog` com Nome e Chave. A chave segue o nome como slug até o operador editá-la.
- A página da receita usa o mercado da URL, não o do produto. **Renomear** é um `Dialog` só com Nome. **Excluir receita** aparece só sem variações.
- O vínculo continua só na variação: a página da receita mostra as variações, mas não vincula nem desvincula. Assim existe um único caminho para o mesmo dado, sob as mesmas travas.
- O campo **Receita (conteúdo)** da variação vira um `select` das receitas cadastradas do mercado, mais "Sem receita". Isso acaba com chaves digitadas erradas, e a API recusa uma chave sem cadastro (`recipe_not_registered`).

### 1a. Página com as seções Imagem e Rótulo

O rótulo tem doze campos e quatro listas, e o diálogo de 520 px não comporta isso. A página segue o shell e os cards (`Section`) do painel.

### 2. Conferência da imagem no navegador

`src/lib/imageUpload.ts` recebe a leitura base64 de `feedbacks.ts`, mais `readImageSize(file)` (um `Image` com `URL.createObjectURL`, lendo `naturalWidth`/`naturalHeight`) e `checkRecipeImage(file)`. As constantes (1024 × 636, 5 MB, tipos) espelham as da API, que continua sendo a fonte de verdade: a conferência no painel só poupa o envio.

### 3. Estado do rótulo vem da API

O painel não calcula a completude. Ele mostra `labelStatus` e `labelMissing` da resposta. Assim a regra "US exige pelo menos um aviso" vive num lugar só.

### 4. Listas sem biblioteca

Cada lista é um array no estado da página, com linhas de input, **Adicionar** e **Remover**. Linhas vazias são descartadas ao salvar.

## Risks / Trade-offs

- [As constantes do painel divergirem das da API] → O 422 da API aparece no card do mesmo jeito. Um teste de fixture compara as constantes com a mensagem esperada.
