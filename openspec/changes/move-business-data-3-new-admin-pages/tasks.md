# Tasks

Fase 3 de 3. Sai depois do change de mesmo nome da API (`eden-bowls-backend`, PR #17). Rode só os testes relacionados (`npx vitest run <arquivo>`).

## 1. Contrato e menu

- [ ] 1.1 Com o manifesto da API da fase 3, rodar `npm run contract:sync`. Acrescentar "Parâmetros nutricionais" (Ferramentas) e "Configurações" (Administração) a `src/lib/menu.ts` e as rotas a `src/App.tsx`. Verificar com `npx vitest run src/lib/menu.test.ts src/lib/api.test.ts`: o cenário "Veterinarian has no settings".

## 2. Parâmetros nutricionais

- [ ] 2.1 Criar `src/lib/nutritionSettings.ts` (tipos, rótulos dos portes, fatores e mensagens dos erros) e `src/pages/NutritionSettingsPage.tsx` com a aba "Fases da vida" e a prévia com confirmação (decisões 1 a 3). Verificar com `npx vitest run src/pages/NutritionSettingsPage.test.tsx`: os cenários "Operator reads only", "Preview before lowering the senior age" e "Invalid limits".
- [ ] 2.2 Aba "Raças": incluir, mudar o porte, desativar, todas com prévia. Verificar com o mesmo teste: o cenário "Add a giant breed".
- [ ] 2.3 Aba "Fatores": publicado, rascunho, salvar, descartar, publicar e histórico com "Copiar para rascunho" (decisão 4). Verificar com o mesmo teste: o cenário "Publish a changed factor".
- [ ] 2.4 No simulador, "Simular com o rascunho" para `nutrition.settings.write`. Verificar com `npx vitest run src/pages/NutritionSimulatePage.test.tsx`: o cenário "Simulate the draft".

## 3. Configurações

- [ ] 3.1 Criar `src/lib/adminSettings.ts` e `src/pages/SettingsPage.tsx` com a aba "Empresa". Verificar com `npx vitest run src/pages/SettingsPage.test.tsx`: os cenários "Operator reads but cannot save" e "Invalid CNPJ".
- [ ] 3.2 Aba "Documentos legais" (decisão 5). Verificar com o mesmo teste: os cenários "Publish new terms" e "Version id already used".
- [ ] 3.3 Aba "E-mails automáticos". Verificar com o mesmo teste: o cenário "Cap lower than batch".

## 4. Verificação

- [ ] 4.1 Rodar `npx vitest run --changed`, `npx tsc -b` e `npm run lint`.
