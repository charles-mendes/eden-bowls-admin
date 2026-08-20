---
applyTo: "e2e/**/*,playwright.config.ts"
description: "Use when creating, changing, debugging, or validating Playwright browser flows and admin-to-backend integration."
---

# Playwright e fluxos E2E

Use Playwright para validar o comportamento completo do operador: login, papéis, listagens, detalhe, mutações, navegação crítica e integração painel-backend.

O teste deve validar a interação real no navegador e, quando necessário, as chamadas de API correspondentes: endpoint, método, `Authorization: Bearer`, query/payload e feedback na UI.

Não deixe a suíte só com login. Specs vigentes:

- `e2e/specs/admin-login.spec.ts` — operator com Bearer, customer bloqueado, nutritionist no simulador
- `e2e/specs/admin-users.spec.ts` — lista de clientes, detalhe, PATCH de instruções de entrega
- `e2e/specs/admin-orders.spec.ts` — lista e detalhe de checkouts
- `e2e/specs/admin-onboarding.spec.ts` — lista 360 e detalhe por `user_id`
- `e2e/specs/admin-catalog.spec.ts` — lista de produtos e PATCH de plano
- `e2e/specs/admin-billing.spec.ts` — lista de assinantes, POST de sync, detalhe
- `e2e/specs/admin-readonly.spec.ts` — menu e botões de mutação ocultos

Helpers: `e2e/helpers/mockAdminApi.ts` (`installAdminApiMocks`, `openAuthed`, `e2eProfiles`). Testes devem permanecer independentes: cada spec monta o mock e, se pular o login, usa `openAuthed`.

## Não rode a suíte a cada alteração

Não execute `npx playwright test` nem `npm run test:e2e` depois de cada mudança. A suíte E2E é cara; um arquivo de UI alterado não justifica todos os fluxos.

Prefira o spec do fluxo afetado, ou um único teste:

```bash
npx playwright test e2e/specs/admin-login.spec.ts --workers=4
npx playwright test e2e/specs/admin-login.spec.ts -g "logs in as operator" --workers=4
```

## Não use UI Mode no fluxo do agente

Evite `npx playwright test --ui` e `npm run test:e2e:ui` no fluxo normal da IA.

`--ui`, `--headed` e `--debug` são para o desenvolvedor investigar localmente. Para a IA, rode o spec (ou `-g`) em modo headless com 4 workers.

## Quando executar

- Alteração pequena em componente: prefira Vitest e teste de componente.
- Alteração em fluxo: execute o Playwright do spec/teste afetado.
- Alteração estrutural ou de alto impacto: execute os fluxos afetados e considere a suíte completa.

Não use Playwright para testar isoladamente regras que podem ser cobertas por Vitest.

Se Playwright ainda não existir no `package.json`, não instale nem rode a suíte só para cumprir esta regra.

## Como executar (paralelismo obrigatório)

Toda execução é paralela com 4 workers. `playwright.config.ts` deve definir `workers: 4` e `fullyParallel: true`; não altere esses valores nem os sobrescreva na linha de comando.

```bash
npx playwright test e2e/specs/admin-login.spec.ts --workers=4
npx playwright test e2e/specs/admin-users.spec.ts -g "loads customer detail" --workers=4
npx playwright test e2e/specs/admin-readonly.spec.ts --workers=4
npm run test:e2e   # suíte completa — só alto impacto
```

- Proibido `--workers=1` ou qualquer flag que serialize a execução.
- Testes devem ser independentes: sem estado global compartilhado, sem ordem implícita, sem porta ou arquivo fixo compartilhado entre specs.
- Se um spec só passa serialmente, corrija o isolamento do teste. Não reduza o paralelismo.

## Artefatos: não gerar coisas gigantes na execução normal

Não deixe permanentemente `trace: 'on'`, `video: 'on'` ou `screenshot: 'on'`. A execução normal em `playwright.config.ts` deve ser:

```ts
use: {
  trace: 'retain-on-failure',
  screenshot: 'only-on-failure',
  video: 'off',
}
```

Assim, quando passa: **PASS** e acabou. Quando falha: **FAIL** → trace e screenshot ficam disponíveis para investigação.

Não altere esses valores na config. Não passe `--trace on`, `--video on`, `--screenshot on` nem `--trace=on` na linha de comando.

## Saída compacta

O reporter padrão é `line` (`playwright.config.ts`): 1 teste, 1 erro, stack trace relevante. Não peça traces, screenshots, HTML report ou logs verbosos na saída do agente. Não use `--reporter=html` nem `--debug` no fluxo normal.

## Validação painel -> backend

Quando houver API, valide endpoint, método HTTP, headers, `Authorization: Bearer`, parâmetros, payload, status, resposta, transformação e tratamento de erros. Use assertions para confirmar que o painel enviou e recebeu os dados esperados.

Fluxo de diagnóstico:

```text
Falha no navegador
  -> identificar o ponto da falha
  -> classificar UI, estado, API, autenticação, papéis, backend, banco ou infraestrutura
  -> capturar request, payload, headers e response
  -> reproduzir no teste mais rápido possível
  -> corrigir
  -> executar o teste específico
  -> repetir o fluxo Playwright afetado
```

Um HTTP 500 não justifica alteração aleatória no backend. Primeiro confirme a comunicação e valide o serviço responsável.

## Suíte e falhas

- Não execute a suíte completa após toda alteração pequena.
- Não use `skip`, `only`, assertions removidas ou timeout aumentado como solução.
- Se um bug for encontrado, crie ou ajuste um teste de regressão sempre que possível.
- Depois de três ciclos de correção sem solução, pare e informe o erro, a causa provável, os arquivos, as tentativas e o próximo passo.
