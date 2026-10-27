# Design

## Context

- A API devolve a apresentação em `GET /api/v1/admin/catalog/recipe-content/:key` (`presentation`, `presentationUpdatedAt`) e a recebe inteira no `PUT .../presentation` com `{ presentation }`. A recusa é 422 `recipe_presentation_invalid` com `fields` (por exemplo `title`, `highlights[2]`, `colors.pillBg`).
- O detalhe do produto marca cada variação com `recipePresentationReady`, e a ativação recusa com `missing: ['presentation']`.
- `POST /api/v1/admin/stripe/first-purchase-coupons` aceita `percent_off` (1 a 90, 422 `invalid_percent_off`). O percentual do prazo só muda quando o código novo é vinculado ao prazo (`assign_first_purchase_slot`). A saúde sincronizada traz `slots[term].percent_off` e `percent_mismatch`.
- `GET/PUT /api/v1/admin/shipping/settings` trazem e aceitam `us.max_transit_days` (1 a 10, 422 `invalid_max_transit_days`).
- O detalhe do produto traz `largePackLimit` (padrão 8) e o `PATCH` o aceita (1 a 60, 422 `product_large_pack_limit_invalid`), também em produto publicado. Cada variação traz `weight`.

## Goals / Non-Goals

**Goals:** editar os quatro dados nas páginas existentes, sem página nova.

**Non-Goals:** prévia da página da loja; editar os termos de uso (fase 3); escolher outro produto para a recomendação.

## Decisions

1. **Apresentação num componente próprio.** `RecipePresentationSection`, no molde de `RecipePlanImageSection`, para não crescer `RecipeContentPage`. Destaques são uma linha cada (como os ingredientes), e as cores têm um seletor de cor e o campo hex lado a lado. O botão salva tudo; os campos recusados ficam marcados com `aria-invalid` e listados na mensagem. Os limites de tamanho vão no `maxLength` dos campos, iguais aos da API.
2. **Percentual no formulário existente.** O campo começa no percentual gravado do prazo e volta a ele quando o prazo muda. Se o valor difere do gravado: com "Usar no checkout" marcado, aviso de que os novos checkouts do prazo passam a ter o novo percentual e de que os termos de uso citam o valor; desmarcado, aviso de que o percentual do prazo não muda. O placeholder do código passa a seguir o valor digitado.
3. **Divergência pelo `slots` da saúde.** O cartão mostra "Cupom dá X%" quando `slots[term].percent_mismatch` é verdadeiro. Sem `slots` (antes de sincronizar), compara com o `percent_off` do código listado. Fonte única do percentual esperado: `percentFor`.
4. **Trânsito na seção UPS.** O campo fica em "UPS", ao lado da caixa padrão, porque só a cotação da UPS informa o trânsito. Acima de 1 dia, aviso de que a caixa térmica foi pensada para cerca de 48 horas.
5. **Limite do pacote grande editável em produto publicado.** Ele não muda cobrança nem variação, só a recomendação. O botão "Salvar" da seção passa a valer também em produto publicado, enviando só `largePackLimit`. Os pesos mostrados vêm das variações ativas (`weight`), como a API usa.

## Risks / Trade-offs

- [Painel publicado antes da API] → Sem `presentation` a seção começa vazia, e salvar devolve 404; sem `largePackLimit` o campo mostra 8. O Migration Plan da API publica a API primeiro.
- [Operador sobe o percentual sem revisar os termos] → Aviso no formulário; o texto legal fica editável na fase 3.
- [Recomendação usa o primeiro produto publicado do país] → A dica do campo diz isso; com um produto de plano por país, é o mesmo.
