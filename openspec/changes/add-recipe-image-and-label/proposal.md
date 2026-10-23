# Proposal

## Why

Hoje a ativação de uma variação depende de duas confirmações manuais ("Foto definitiva já está na loja" e "Dados de rótulo já estão na página da receita"), porque a imagem e o rótulo moram no código da loja e o painel não sabe o que está lá. O change irmão `add-recipe-image-and-label` em `eden-bowls-backend` passa a guardar a imagem e o rótulo de cada receita por mercado e sabor. O painel precisa da tela para cadastrar esse conteúdo e mostrar, na tabela de variações, quem já tem cadastro.

## What Changes

**Fase 1: imagem**
- Nova página "Conteúdo da receita" (`/catalog/products/:productId/recipes/:flavorSlug`), aberta a partir da variação. A seção **Imagem** tem prévia no formato do banner, escolha de arquivo, conferência de tipo, peso e tamanho (1024 × 636) antes de enviar, e as ações salvar e remover. A página lista as variações que compartilham o conteúdo.
- A tabela de variações ganha a coluna **Conteúdo**, com o selo da imagem e o link para a página.
- No diálogo da variação, a confirmação "Foto definitiva…" só aparece quando o sabor não tem imagem cadastrada, identificada como a opção para imagem no código da loja.

**Fase 2: rótulo**
- A seção **Rótulo** na mesma página tem campos simples, listas editáveis, linhas de níveis de garantia, o selo **Completo** / **Incompleto** com o que falta (vindo da API) e o idioma do mercado indicado.
- A coluna **Conteúdo** ganha o selo do rótulo, e a confirmação "Dados de rótulo…" só aparece quando o rótulo não está completo.

## Capabilities

### New Capabilities

- `operations/catalog-recipe-content`: a página de conteúdo da receita no painel, com a conferência da imagem antes do envio, o formulário do rótulo e o comportamento para `readonly`.

### Modified Capabilities

- Nenhuma. A coluna **Conteúdo** e as confirmações condicionais são requisitos novos de `operations/catalog-recipe-content`. Os requisitos de `operations/catalog-products` não mudam.

## Impact

- Código: `src/pages/RecipeContentPage.tsx` (novo), `src/App.tsx`, `src/pages/ProductDetailPage.tsx`, `src/lib/imageUpload.ts` (extraído de `src/lib/feedbacks.ts`), `src/test/mockAdminFetch.ts`, `src/test/fixtures.ts`, `contracts/backend-routes.json`, `e2e/specs/admin-catalog.spec.ts` e `e2e/specs/admin-readonly.spec.ts`.
- Depende do change irmão em `eden-bowls-backend` (rotas, validação, completude e ativação), que sai antes em cada fase. O `contract:sync` daqui roda depois do `routes:manifest` de lá. A loja (`eden-bowls`) tem o change irmão de consumo.
- As receitas que chegam em 23/10/2026 seguem o fluxo atual (`.png` na loja e confirmação manual).
