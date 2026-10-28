# Design

## Context

- Menu: `src/lib/menu.ts` filtra os itens por papel (`roles`). O item de demonstração `/insights` entra depois de Hoje por `visibleMenuItems`.
- Guarda: `src/routes/RequireAuth.tsx` manda a sessão só de veterinário(a) para `/nutrition/simulate` em qualquer outra rota.
- Sessão: `AuthContext` expõe `user.markets`, `user.permissions` e `hasPermission`. `src/lib/markets.ts` traz `sessionMarkets`, `hasBothMarkets`, `defaultMarket` e `currencyForMarket`.
- Padrões visuais já aprovados para o cliente estão em `BusinessOverviewPage.tsx` (segmented de mercado e período, barras CSS, funil, tabela de packs) e na spec `operations/business-overview`.
- CSV: `OnboardingPage.tsx` baixa `checkouts.csv` com `fetch` e `blob` usando o token da sessão.
- O contrato `contracts/backend-routes.json` faz o Vitest falhar quando o painel chama uma rota que não está no manifesto.

## Goals / Non-Goals

**Goals:**
- Reaproveitar a linguagem visual da Visão do negócio, para a demonstração ao cliente parecer o mesmo produto.
- Uma chamada por aba visível. Trocar de aba não recarrega as outras.

**Non-Goals:**
- Biblioteca de gráficos. As barras continuam em CSS, como em `/insights`.
- Exportar PDF ou imprimir. O CSV cobre a necessidade, e a página pode ser apresentada em tela.
- Mudar ou remover `/insights`.

## Decisions

1. **`src/lib/reports.ts` concentra tipos, query string e formatação.** Inclui `fetchReport(tab, params)`, `reportQuery(state)` (mapeia `aba/mercado/de/ate` ↔ `market/from/to/granularity`), `formatDelta(value, previous, kind)` e `minorToMoney(minor, market)`. Isso deixa a página testável sem render e evita duplicar a formatação de `businessOverview.ts`.
   - Alternativa: estender `businessOverview.ts`. Foi descartada porque aquele módulo é a fixture da demonstração e está presa à spec dela.

2. **Componentes em `src/components/reports/`.** `KpiCard` (valor, variação ou "agora", badge opcional), `BarSeries` (série agrupada com tooltip e `aria-label`), `FunnelBars` e `ReportTable`. Os componentes usam as próprias classes `insights-*` da página de demonstração, sem mudar o visual de `/insights`, e só acrescentam `report-*` para bucket parcial, linha de total e colunas do Resumo.

3. **Estado na URL com `useSearchParams`.** A URL é a fonte da verdade. O componente só normaliza: troca o mercado fora da sessão pelo padrão e o período inválido por 30 dias, com `replace`. O período rápido grava `de`/`ate` concretos, para o link continuar igual no dia seguinte.

4. **Menu por papel e por permissão.** `MenuItem` ganha `permission?: string`, e `visibleMenuItems(roles, permissions)` filtra pelos dois. Só **Relatórios** usa o campo por enquanto, sem mudança para os outros itens.
   - Alternativa: só papel. Foi descartada porque, durante o deploy, um painel novo com uma API antiga mostraria um item que responde 403.

5. **Erros.** `apiRequest` já lança com `status` e `details.code`. A aba mostra o `div.alert` com a mensagem da API, e `market_forbidden` não vira tabela vazia (a regra que já existe em `admin-market-scope`).

## Risks / Trade-offs

- [O painel sobe antes da API] → o item exige `reports.read`, que a API antiga não manda, e então fica oculto.
- [A série diária de 366 dias fica larga] → a granularidade automática da API escolhe mês acima de 120 dias. Em tela estreita a série rola na horizontal dentro do card, e a página não rola.
- [MRR estimado lido como receita real na demonstração] → badge **Estimado** e tooltip explicando a regra.

## Migration Plan

1. Esperar o merge do backend com `docs/api-routes.json` atualizado.
2. `npm run contract:sync` e commit de `contracts/backend-routes.json`.
3. Deploy do painel. Rollback: reverter o deploy, porque a API continua compatível.
