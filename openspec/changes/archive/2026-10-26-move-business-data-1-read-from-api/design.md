# Design

## Context

`CouponsPage.tsx` usa `TERM_PERCENT[term]` em quatro lugares: o cartão do prazo, a opção do seletor, os placeholders de código e nome, e a variável `percent` do formulário. O aviso da linha 308 tem "25%/40%" escrito no texto. A saúde (`PromoHealth`) já é carregada pela página na troca de conta.

## Goals / Non-Goals

**Goals:** uma única fonte para o percentual, a da API.

**Non-Goals:** editar o percentual (fase 2); mudar o visual da página.

## Decisions

1. `PromoHealth` ganha `terms?: Array<{ subscription_term_months: number; discount_percent: number }>`. Uma função `percentFor(health, term): number | null` lê dali e é a única fonte do percentual.
2. Sem percentual, o texto mostra `-`. Os placeholders sem percentual ficam `BEMVINDO` e `First purchase <n>m`. Mostrar um número antigo seria pior que não mostrar nada.
3. O aviso monta "25%/40%" a partir dos prazos 3 e 6. Se faltar algum, a frase cita só o que existe; se faltarem os dois, ela fica sem o parêntese.

## Risks / Trade-offs

- [O painel ser publicado antes da API] → A página mostra `-` e segue funcionando; o Migration Plan da API publica a API primeiro.
