# Proposal

## Why

O painel tem o **Hoje** operacional e não tem uma tela de negócio para o cliente ver receita, assinaturas, funil e mix. O protótipo da **Visão do negócio** já fecha o recorte da demo: dados fictícios, selo visível e o que depende de API nova marcado como Fase 2. Sem essa página, a conversa com o cliente continua em HTML solto.

## What Changes

- Nova página **Visão do negócio** no grupo Visão geral, ao lado de Hoje, com a ordem do protótipo: faixa de Hoje, Receita, cinco cartões de assinaturas, tendência semanal, funil de checkout e mix das próximas entregas.
- A página e o item de menu só existem com `VITE_DEMO_INSIGHTS=true`. Sem a flag, o menu não mostra o item e `/insights` volta para `/dashboard`. Produção fica sem MRR inventado.
- Filtros **Brasil / EUA** (só com os dois mercados; sem “Todos”) e **7 / 30 / 90 dias**. Mercado único omite o controle; o subtítulo diz o mercado. O período escala só faturamento, canceladas, churn e as contagens do funil. A tendência continua sendo as últimas 8 semanas.
- Todos os valores desta fase são fictícios. A página mostra o selo **Dados de demonstração**, não traz horário de atualização e não chama API para as métricas.
- Gráficos em CSS e `div`. Tooltip só na tendência; funil e mix imprimem o número ao lado da barra. Sem Recharts, visx ou outra lib.
- Etiquetas **Fase 2** desligadas por padrão. `?fase2=1` é exceção aceita e só faz efeito com a flag de demo ligada. Marcam Receita, tendência e mix.
- Skill do painel: renomear `frontend-design` para `admin-panel-design` e acrescentar a seção de gráficos. A direção visual não muda. O painel continua em IBM Plex Sans; Inter fica só no canvas.

## Capabilities

### New Capabilities

- `operations/business-overview`: a tela Visão do negócio — flag de demo, quem vê, o que o período muda, filtros, dados de demonstração, gráficos sem biblioteca e o recorte da Fase 2.

### Modified Capabilities

- `operations/admin-market-scope`: o seletor de mercado desta página segue a sessão; não há “Todos”; sessão de um mercado omite o controle.

## Impact

- Painel: `src/lib/menu.ts`, `src/App.tsx`, `src/vite-env.d.ts`, página e fixture novos, CSS dos gráficos, testes Vitest (menu + página + guarda da veterinária). Sem rota nova no backend e sem `contract:sync`.
- Skill e apontadores vivos: `.agents/skills/frontend-design/` vira `admin-panel-design/`. Citações fora de `openspec/changes/archive/` passam para o nome novo.
- Sem mudança em `package.json`. Loja e API ficam de fora.
