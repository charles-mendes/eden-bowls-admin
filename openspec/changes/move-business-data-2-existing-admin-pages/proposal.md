# Proposal

## Why

Fase 2 de 3 da retirada de dados de negócio do código. O change irmão da API (`move-business-data-2-existing-admin-pages` em `eden-bowls-backend`) gravou no banco quatro dados que antes exigiam deploy: a apresentação da receita na loja, o percentual de cada prazo do cupom de 1ª compra, o prazo máximo de trânsito nos EUA e o limite do pacote grande do plano. Esta é a parte do painel: cada dado ganha edição na página onde o operador já trabalha.

## What Changes

- **Receitas → Apresentação na loja.** A página da receita ganha a seção "Apresentação na loja": título, chamada, resumo, destaques e as cinco cores, salvos inteiros com `PUT /api/v1/admin/catalog/recipe-content/:key/presentation`. Os erros 422 marcam os campos inválidos.
- **Produtos → ativação.** A falta de apresentação aparece entre as pendências da variação e na recusa de ativação.
- **Cupons 1ª compra → percentual.** O formulário "Criar cupom na Stripe" ganha o campo "Desconto na 1ª fatura" (1 a 90 %), que começa no percentual gravado do prazo e vai como `percent_off`. Mudar o percentual avisa que os termos de uso citam o valor. O cartão do prazo avisa quando o cupom vinculado dá outro percentual (`percent_mismatch`).
- **Frete → prazo máximo de trânsito nos EUA.** A seção UPS ganha "Prazo máximo de trânsito" (1 a 10 dias úteis), salvo como `us.max_transit_days`, com aviso acima de 1 dia por causa da caixa térmica.
- **Produtos → limite do pacote grande.** A seção "Plano" ganha "Limite do pacote pequeno" (1 a 60 pacotes), salvo como `largePackLimit`, e mostra os pesos das variações ativas que entram na recomendação.
- Contrato: `npm run contract:sync` com a rota nova da apresentação.

## Capabilities

### New Capabilities

- `operations/shipping-settings`: edição do prazo máximo de trânsito dos EUA na página de frete.

### Modified Capabilities

- `operations/billing-coupons`: percentual escolhido ao criar o cupom e aviso de percentual divergente.
- `operations/catalog-products`: limite do pacote grande na seção "Plano" e apresentação entre as pendências de ativação.
- `operations/catalog-recipe-content`: seção "Apresentação na loja" (capability criada por `add-recipe-image-and-label`, ainda não arquivado).

## Impact

- `src/pages/CouponsPage.tsx`, `src/pages/ShippingPage.tsx`, `src/lib/shippingSettings.ts`, `src/pages/ProductDetailPage.tsx`, `src/pages/RecipeContentPage.tsx`, componente novo `src/components/RecipePresentationSection.tsx`, `src/lib/recipeContent.ts`, testes das páginas e `src/test/fixtures.ts`, `contracts/backend-routes.json`.
- Depende da API da fase 2 publicada antes (PR #16 da API).
