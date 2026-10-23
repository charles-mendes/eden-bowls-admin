# Design

## Context

Motivação em `proposal.md`. O contrato (rotas, formato `{ mimeType, imageBase64 }`, `labelStatus`/`labelMissing`, `recipeImageUrl`/`recipeLabelStatus` no detalhe do produto, códigos 422/409) está no change irmão em `eden-bowls-backend` (`recipe-content`). No painel, o SPA usa `apiRequest`, sem biblioteca de formulário, e `src/lib/feedbacks.ts` já converte um `File` em base64. Cada sessão é limitada a mercados, e o mercado do produto é o seu `planCountry`.

## Goals / Non-Goals

**Goals:** cadastrar imagem e rótulo sem sair do catálogo, com o erro de tamanho pego antes do envio.

**Non-Goals:** regras de completude ou de tamanho próprias (a API decide); editar título, tagline e cores da receita.

## Decisions

### 1. Página própria em vez de crescer o diálogo

O rótulo tem doze campos e quatro listas, e o diálogo de 520 px não comporta isso. A página `RecipeContentPage.tsx` segue o shell e os cards (`Section`) do painel. O mercado vem do produto carregado, então o link carrega `productId` e `flavorSlug`.

### 2. Conferência da imagem no navegador

`src/lib/imageUpload.ts` recebe a leitura base64 de `feedbacks.ts`, mais `readImageSize(file)` (um `Image` com `URL.createObjectURL`, lendo `naturalWidth`/`naturalHeight`) e `checkRecipeImage(file)`. As constantes (1024 × 636, 5 MB, tipos) espelham as da API, que continua sendo a fonte de verdade: a conferência no painel só poupa o envio.

### 3. Estado do rótulo vem da API

O painel não calcula a completude. Ele mostra `labelStatus` e `labelMissing` da resposta. Assim a regra "US exige pelo menos um aviso" vive num lugar só.

### 4. Listas sem biblioteca

Cada lista é um array no estado da página, com linhas de input, **Adicionar** e **Remover**. Linhas vazias são descartadas ao salvar.

## Risks / Trade-offs

- [As constantes do painel divergirem das da API] → O 422 da API aparece no card do mesmo jeito. Um teste de fixture compara as constantes com a mensagem esperada.
