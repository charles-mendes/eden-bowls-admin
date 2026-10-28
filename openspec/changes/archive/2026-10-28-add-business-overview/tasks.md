# Tasks

Rode só os testes do arquivo citado (`npx vitest run <arquivo>`). Não instale biblioteca de gráfico. A página só aparece com `VITE_DEMO_INSIGHTS=true`.

## 1. Skill do painel

- [x] 1.1 Mover `.agents/skills/frontend-design/` para `.agents/skills/admin-panel-design/`, mudar `name` para `admin-panel-design` e acrescentar a seção **Charts** (série principal no accent, comparação em cinza, sem cor de status como série, barras sem pizza/3D, `tabular-nums` + pt-BR, `aria-label`, tooltip só quando o número não está impresso ao lado da marca). Verificar que o diretório antigo não existe e que `SKILL.md` contém `name: admin-panel-design` e a seção Charts.
- [x] 1.2 Atualizar as citações vivas de `frontend-design` no repositório do painel para `.agents/skills/admin-panel-design/SKILL.md`. Verificar com `rg "frontend-design"` na raiz do painel: os hits que restarem ficam só em `openspec/changes/archive/`.

## 2. Flag, menu e rota

- [x] 2.1 Criar `src/lib/demoInsights.ts` (`demoInsightsEnabled` só com `VITE_DEMO_INSIGHTS === 'true'`) e declarar a variável em `src/vite-env.d.ts`. Acrescentar **Visão do negócio** (`/insights`) em `src/lib/menu.ts`, depois de Hoje, só quando a flag está ligada, para `admin`, `operator` e `readonly`. Verificar com `npx vitest run src/lib/menu.test.ts src/lib/demoInsights.test.ts`: com a flag, a ordem bate e veterinarian não vê o item; sem a flag, o href some até para admin.
- [x] 2.2 Registrar `/insights` em `src/App.tsx`: com a flag, a página; sem a flag, redirect para `/dashboard`. Verificar com `npx vitest run src/routes/RequireAuth.test.tsx`: veterinarian-only em `/insights` cai em `/nutrition/simulate` e não vê o selo. Verificar no teste da página que operator sem a flag não vê o MRR de demonstração.

## 3. Fixture e página

- [x] 3.1 Criar `src/lib/businessOverview.ts` com a tabela do protótipo. O fator do período (0,25 / 1 / 2,9) mexe só em faturamento, canceladas, churn e nas três contagens do funil. MRR, ticket, deltas, os outros cartões, a faixa de Hoje, as 8 semanas, o mix e a taxa de conversão do funil ficam fixos. Verificar com `npx vitest run src/lib/businessOverview.test.ts`: Brasil 30 dias formata o MRR `241390`; 7 dias reduz faturamento e o funil e mantém o MRR.
- [x] 3.2 Criar `src/pages/BusinessOverviewPage.tsx` com `PageFrame`, selo **Dados de demonstração**, subtítulo com mercado e período sem horário, a ordem Hoje → Receita → Assinaturas → Tendência → Funil → Mix, e os links `/dashboard`, `/billing` e `/onboarding/sessions`. O ponto de **Renovam em 7 dias** é cinza, não o azul do accent. Verificar com `npx vitest run src/pages/BusinessOverviewPage.test.tsx`: o selo está visível, a ordem bate, o subtítulo não tem hora e a página não chama `apiRequest` para as métricas.

## 4. Filtros, gráficos e Fase 2

- [x] 4.1 Grupo de mercado só com os dois mercados da sessão, default Brasil, sem Todos. Um mercado só omite o controle e o subtítulo nomeia esse mercado. Verificar no teste da página: admin vê Brasil/EUA; operator BR não tem o grupo e o subtítulo diz Brasil; 30→7 dias muda faturamento e funil, não o MRR, e a tendência continua “últimas 8 semanas”, sem novo `apiRequest`.
- [x] 4.2 Tendência em barras agrupadas com `aria-label` e tooltip/`title` por semana. Funil com as duas conversões e a contagem em texto. Mix com quantidade em texto e tabela de pacotes. Sem tooltip extra no funil e no mix. Verificar no teste da página: a tendência tem nome acessível e um tooltip com as contagens; o funil mostra as duas conversões.
- [x] 4.3 Etiquetas **Fase 2** só com a flag ligada e `?fase2=1`, em Receita, Tendência semanal e Mix, também para operator. Verificar no teste da página: `/insights` não tem badge; `/insights?fase2=1` marca as três; sem a flag, `?fase2=1` não mostra badge nem o MRR.
- [x] 4.4 Adicionar `e2e/specs/admin-insights.spec.ts` (abertura, selo, troca Brasil/EUA). Verificar com `VITE_DEMO_INSIGHTS=true npx playwright test e2e/specs/admin-insights.spec.ts --workers=4`, num Vite que tenha subido com essa variável (não reutilizar um server da porta 4174 iniciado sem ela).

## 5. Integração

- [x] 5.1 Rodar `npx vitest run --changed`, `npx tsc -b` e `npm run lint`.
