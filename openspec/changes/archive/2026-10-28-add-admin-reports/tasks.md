# Tasks

## 1. Contrato e sessão

- [x] 1.1 Rodar (a partir da branch `feat/add-admin-reports` do backend, PR #19) `npm run contract:sync` e commitar `contracts/backend-routes.json` com as oito rotas `/admin/reports/*`. Verificar com o teste de contrato do Vitest.
- [x] 1.2 Adicionar `reports.read`/`reports.export` às fixtures de sessão (`src/test/fixtures.ts`) de admin, operador e somente leitura (este último só com `reports.read`). Verificar com `npx vitest run src/contexts/AuthContext.test.tsx`.

## 2. Biblioteca de relatórios

- [x] 2.1 Criar `src/lib/reports.ts` com os tipos das respostas, `reportQuery` (URL ↔ API), validação de período (máximo 366 dias, início antes do fim), `minorToMoney` e `formatDelta` (% e p.p.; omitida quando o anterior é `null` ou 0). Verificar com `src/lib/reports.test.ts`: `R$ 10.000,00`, `US$ 12.345,67`, `+25,0%`, mercado fora da sessão e intervalo de 367 dias.

## 3. Menu e rota

- [x] 3.1 Adicionar `permission` a `MenuItem` e o item **Relatórios** (`/reports`, papéis admin, operador e somente leitura, `reports.read`) depois de Hoje e de Visão do negócio, passando as permissões a `visibleMenuItems`/`groupedMenuItems` e ao `AdminLayout`. Verificar com `src/lib/menu.test.ts`: ordem com a flag ligada e desligada, e ausência sem permissão ou para veterinário(a).
- [x] 3.2 Registrar `/reports` em `App.tsx` dentro do `ProtectedShell`. Verificar com um teste de `RequireAuth`: veterinário(a) em `/reports` cai no simulador sem chamar `/admin/reports/*`.

## 4. Componentes

- [x] 4.1 Reaproveitar as classes CSS de barra, funil e tabela de `/insights` (`insights-*`) sem mudar o visual; os relatórios usam as mesmas classes e só acrescentam `report-*` (parcial, total, colunas). Renomear ficou de fora para não mexer no PR #10. Verificar com `npx vitest run src/pages/BusinessOverviewPage.test.tsx` (deve continuar verde).
- [x] 4.2 Criar `src/components/reports/KpiCard.tsx`, `BarSeries.tsx`, `FunnelBars.tsx` e `ReportTable.tsx` (tabular-nums, destaque e cinza, tooltip e `aria-label` com totais). Verificar com `src/components/reports/*.test.tsx`.

## 5. Página

- [x] 5.1 Criar `src/pages/ReportsPage.tsx` com cabeçalho (subtítulo com mercado e datas, sem hora), seletor de mercado pela sessão sem Todos, período, granularidade, abas e o estado na URL (os períodos rápidos terminam ontem). Verificar com `src/pages/ReportsPage.test.tsx`: link compartilhado restaurado, operador BR sem controle e `market=BR` em toda chamada, admin com Brasil por padrão, intervalo personalizado inválido sem request.
- [x] 5.2 Implementar a aba Resumo (colunas por mercado, sem Total) e as abas Receita, Assinaturas, Aquisição, Mix, Operação e Estoque conforme a spec, com **Faturamento bruto**, **Chegaram a ativar**, os avisos (**Estimado**, datas aproximadas, faturas em outra moeda), barras parciais com tooltip **período parcial** e sem bloco UPS no BR. Verificar com cenários no mesmo teste, usando respostas mockadas que existem no contrato.
- [x] 5.3 Implementar **Exportar CSV** (só com `reports.export`, `report` = aba atual, `formato=excel`, nome do arquivo vindo do header) e os erros em `div.alert` para 400, 403 e 503. Verificar com os cenários de somente leitura sem botão, operador exportando Estoque e timeout sem cards zerados.
- [x] 5.4 Mostrar a nota de `unassignedCheckouts` (só vem para admin) em Aquisição, o cartão **Aguardando pagamento** separado dos atrasados em Operação, e a marca **sem nome no catálogo** em Mix e Estoque, usando o `label` do pack da API. Verificar com cenários no `ReportsPage.test.tsx`.

## 6. Integração

- [x] 6.1 Rodar `npx vitest run src/lib src/pages/ReportsPage.test.tsx src/pages/BusinessOverviewPage.test.tsx` e corrigir as falhas. Depois rodar `npm run build`.
- [x] 6.2 Com a API local já com a migração 055 e 056, abrir `/reports` como admin (Resumo com Brasil e Estados Unidos), como operador BR (sem controle de mercado) e como somente leitura (sem CSV). Anotar o resultado no PR. Conferido pelo usuário em 2026-10-28 com a API local (admin, operador BR e somente leitura).
