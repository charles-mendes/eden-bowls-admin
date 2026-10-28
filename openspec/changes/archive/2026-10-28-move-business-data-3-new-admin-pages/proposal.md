# Proposal

## Why

Fase 3 de 3 da retirada de dados de negócio do código. O change irmão da API (`move-business-data-3-new-admin-pages` em `eden-bowls-backend`, PR #17) levou para o banco os dados que não cabiam em nenhuma página do painel: os fatores e grupos de raça da recomendação, os limites de fase da vida e as raças gigantes, os dados da empresa, os documentos legais e as chaves dos e-mails automáticos. Esta é a parte do painel: duas páginas novas para editá-los.

## What Changes

- **Novo item "Parâmetros nutricionais"** (`/nutrition/settings`, grupo Ferramentas), visível para veterinária, admin, operador e somente leitura com `nutrition.simulate`. Três abas:
  - **Fases da vida:** meses de adulto e sênior por porte e mercado. Antes de salvar, a página mostra a prévia de quantos pets com assinatura ativa mudariam de fase e pede confirmação acima de zero.
  - **Raças:** raças com porte próprio por mercado (nome PT, nome EN, porte), incluir, mudar o porte e desativar, também com prévia.
  - **Fatores:** o conjunto publicado (fatores, NEM e grupos de raça), o rascunho editável, simular com o rascunho, publicar, descartar e o histórico com "Copiar para rascunho".
  - Editar exige `nutrition.settings.write`; sem ela, tudo é só leitura.
- **Novo item "Configurações"** (`/config`, grupo Administração), visível com `settings.read`. Três abas:
  - **Empresa:** razão social, CNPJ/EIN, endereço, e-mail de suporte e URL da loja por mercado; salvar só com `settings.company.write`.
  - **Documentos legais:** versão vigente e histórico da política de privacidade e dos termos, por mercado; publicar uma versão nova só com `legal.write`.
  - **E-mails automáticos:** e-mail de mudança de fase ligado ou pausado, lote e limite diário do anúncio; salvar com `settings.email.write`.
- O simulador nutricional ganha "Simular com o rascunho" para quem tem `nutrition.settings.write`.
- Contrato: `npm run contract:sync` com as rotas novas.

## Capabilities

### New Capabilities

- `operations/nutrition-settings`: página de parâmetros nutricionais (fases, raças, fatores).
- `operations/admin-settings`: página de configurações (empresa, documentos legais, e-mails automáticos).

### Modified Capabilities

Nenhuma além do menu, descrito nas capabilities novas.

## Impact

- `src/App.tsx`, `src/lib/menu.ts` e testes do menu.
- Páginas novas: `src/pages/NutritionSettingsPage.tsx` e `src/pages/SettingsPage.tsx`, com testes.
- Libs novas: `src/lib/nutritionSettings.ts` e `src/lib/adminSettings.ts`.
- `src/pages/NutritionSimulatePage.tsx`, fixtures de teste e `contracts/backend-routes.json`.
