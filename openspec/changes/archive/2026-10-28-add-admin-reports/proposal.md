# Proposal

## Why

A **Visão do negócio** (`/insights`) só aparece no build de demonstração e usa números fixos. Para apresentar o negócio ao cliente com dados reais, o painel precisa de uma página de **Relatórios** que leia as rotas novas `/api/v1/admin/reports/*` da API (change irmão `add-admin-reports` em `eden-bowls-backend`). A página separa Brasil e Estados Unidos e segue as mesmas regras de papel, permissão e mercado do resto do painel.

## What Changes

- **Novo item "Relatórios"** no grupo Visão geral, logo depois de **Hoje** (e de **Visão do negócio**, quando o build de demonstração estiver ligado). Aparece para admin, operador e somente leitura. Veterinário(a) não vê o item e, pela URL, cai no simulador.
- **Página `/reports`** com:
  - **Mercado:** Brasil / Estados Unidos, só os mercados da sessão. Não existe opção Todos. Sessão de um mercado só não tem controle e o subtítulo nomeia o mercado.
  - **Período:** 7 dias, 30 dias (padrão), 90 dias, 12 meses e Personalizado (de/até). Os períodos rápidos terminam ontem, para comparar só dias completos. A granularidade é automática (dia, semana ou mês), com troca manual, e os buckets parciais aparecem marcados.
  - **Abas:** Resumo, Receita, Assinaturas, Aquisição, Mix, Operação e Estoque. A aba, o mercado e o período ficam na URL (`?aba=receita&mercado=BR&de=…&ate=…`), para o link poder ser compartilhado.
  - **Resumo:** comparativo Brasil × Estados Unidos lado a lado (cada um na sua moeda) quando a sessão tem os dois mercados, ou um bloco só quando tem um.
  - **Cards** com o valor do período e a variação sobre o período anterior. Os gráficos são de barras CSS no padrão da Visão do negócio (cor de destaque e cinza, tooltip com o valor exato).
  - **Faturamento bruto** (com impostos e frete, sem descontar reembolsos), **Chegaram a ativar** no funil e avisos: **Estimado** no MRR, **datas aproximadas** nas linhas preenchidas pela migração e faturas em outra moeda excluídas.
  - **Exportar CSV**, visível só com a permissão `reports.export`, no formato do Excel em pt-BR (`formato=excel`).
- `AuthContext`/`roles.ts`: `reports.read` e `reports.export` passam a vir em `/admin/me`. O item de menu exige `reports.read`, além do papel.
- `contracts/backend-routes.json` atualizado com `npm run contract:sync`.

## Capabilities

### New Capabilities

- `operations/admin-reports`: página de relatórios com dados reais por mercado e período, comparativo entre mercados e exportação CSV.

### Modified Capabilities

- `operations/admin-market-scope`: a regra do seletor de mercado passa a valer também para Relatórios (sem Todos e sem controle para uma sessão de um mercado).

## Impact

- `src/lib/menu.ts`, `src/App.tsx` (rota `/reports`), `src/routes/RequireAuth.tsx` (sem mudança de regra, só cobertura de teste).
- Novos `src/pages/ReportsPage.tsx`, `src/lib/reports.ts` (tipos, chamadas e formatação), `src/components/reports/*` (cards com variação, barras e tabela) e os testes Vitest correspondentes.
- `src/test/fixtures.ts` com as permissões novas.
- `contracts/backend-routes.json` (depois do manifesto do backend).
- A página de demonstração `/insights` não muda neste change. A remoção fica planejada para o change seguinte, para o cliente não ver dois painéis com números diferentes.
