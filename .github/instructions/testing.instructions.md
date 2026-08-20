---
applyTo: "src/**/*.{ts,tsx}"
description: "Use when changing admin pages, auth, API client, hooks, utilities, components, or tests and deciding the smallest appropriate validation."
---

# Testes automatizados

## Regra principal: nunca rodar tudo por padrão

Evite o fluxo:

```text
Alterou 1 arquivo
  → npm test
  → 500 testes
  → a IA recebe centenas de linhas
```

Prefira:

```text
Alterou 1 arquivo
  → descobrir testes relacionados
  → rodar somente eles
  → se falhar → corrigir
  → só então ampliar o escopo
```

For frontend changes:
1. Run the related Vitest tests first.
2. Do not run the entire test suite unless necessary.
3. Use --related or --changed whenever possible.

Não execute `npm test`, `npm run test:all` nem a suíte completa de Playwright para uma alteração pequena.

Se Vitest ou Playwright ainda não existirem no `package.json`, não instale nem rode a suíte só para cumprir esta regra.

## Estratégia

Depois de alterar código:

1. Identifique os arquivos, funcionalidades e testes afetados.
2. Execute primeiro os testes mais rápidos e específicos.
3. Corrija falhas antes de avançar para a próxima camada.
4. Amplie o escopo só se o recorte passou e o impacto exigir.

A ordem padrão é:

```text
Implementação
  -> Vitest relacionado (--related, -t ou --changed)
  -> Testes de componentes relacionados
  -> Testes de integração, quando aplicável
  -> Playwright do spec/fluxo afetado, quando aplicável
  -> Suíte completa somente em alterações de alto impacto
```

## Vitest

Use Vitest para funções, regras de negócio, validações, hooks, cliente HTTP, utilitários, transformações, cálculos e estados. Os testes devem ficar próximos ao módulo testado quando forem unitários ou de componentes.

Melhor opção após alterar um arquivo:

```bash
npx vitest run --related src/pages/UsersPage.tsx
npm run test:related -- src/pages/UsersPage.tsx
```

`--related` executa só os testes ligados aos arquivos fornecidos. É muito melhor do que `npm test` para uma alteração pequena.

Se você sabe o nome do teste, use `-t`:

```bash
npx vitest run -t "should load admin session"
```

Outra estratégia com base no Git:

```bash
npx vitest run --changed
npm run test:changed
```

Não use `npm test` / `npx vitest run` sem recorte depois de uma alteração pontual.

Se falhar, analise a causa, corrija a implementação e execute novamente o mesmo recorte antes de ampliar o escopo.

## Testes de componentes

Use a ferramenta configurada no projeto, como Testing Library ou React Testing Library, para validar renderização, interação, estados, callbacks, eventos, loading, erro e estado vazio. Não avance para Playwright enquanto os testes afetados não passarem, salvo quando o próprio problema exigir validação E2E.

Ao alterar uma tela do painel, cubra as camadas que a tela realmente tem:

1. **Listagem** — GET com `Authorization: Bearer`, query (`page`/`perPage`/filtros) e linhas visíveis.
2. **Detalhe** — GET do recurso por id e campos principais na UI.
3. **Mutação** — POST/PUT/PATCH com payload, Bearer e feedback de sucesso/erro.
4. **Readonly** — botões de mutação ocultos; menu sem Checkouts, Frete, Cupons 1ª compra e Papéis.

Coloque o teste ao lado da página (`src/pages/UsersPage.test.tsx`, `UserDetailPage.test.tsx`, etc.). Reuse `src/test/mockAdminFetch.ts`, `src/test/fixtures.ts` e `src/test/renderPage.tsx`.

## Integração

Use testes em `src/test/integration/` quando o comportamento envolver múltiplos módulos, contexto, roteamento ou chamadas simuladas. Valide a comunicação entre as partes sem substituir um teste unitário adequado por um teste E2E.

- `src/test/integration/auth-shell.test.tsx` — login operator no shell e nutritionist no simulador.
- `src/test/integration/readonly-shell.test.tsx` — menu e mutações de `readonly`.

## Limites

Use estes limites como referência:

- Vitest relacionado: até 60 segundos.
- Testes de componentes relacionados: até 2 minutos.
- Fluxo Playwright: até 5 minutos.
- Suíte completa: até 10 minutos.

Se um teste ultrapassar significativamente o limite, investigue loop, timeout, serviço indisponível, dependência externa, configuração ou desempenho. Não aumente timeouts indiscriminadamente.

## Specs Playwright do painel

Não cubra só login. O spec do fluxo afetado é o arquivo abaixo, não a suíte inteira:

| Fluxo | Spec | Recorte típico |
|---|---|---|
| Login, customer bloqueado, nutritionist | `e2e/specs/admin-login.spec.ts` | `-g "logs in as operator"` |
| Clientes: lista, detalhe, instruções | `e2e/specs/admin-users.spec.ts` | `-g "loads customer detail"` |
| Checkouts: lista e detalhe | `e2e/specs/admin-orders.spec.ts` | `-g "loads the checkout list"` |
| Onboarding 360: lista e detalhe | `e2e/specs/admin-onboarding.spec.ts` | `-g "loads the 360 checkout detail"` |
| Catálogo: lista e PATCH do produto | `e2e/specs/admin-catalog.spec.ts` | `-g "loads the product list"` |
| Billing: lista, sync, detalhe | `e2e/specs/admin-billing.spec.ts` | `-g "starts a catalog sync"` |
| Readonly sem mutações visíveis | `e2e/specs/admin-readonly.spec.ts` | `-g "hides write-heavy navigation"` |

```bash
npx playwright test e2e/specs/admin-users.spec.ts --workers=4
npx playwright test e2e/specs/admin-users.spec.ts -g "loads customer detail" --workers=4
```

## Alterações de alto impacto

Para autenticação, papéis, permissions, router, API client, estado global, billing, catálogo, onboarding 360, integração com backend, componentes compartilhados, bibliotecas base ou configuração global, execute as camadas relevantes até o Playwright do fluxo afetado e considere a suíte completa.

Playwright na execução normal não gera artefatos gigantes: `trace: 'retain-on-failure'`, `screenshot: 'only-on-failure'`, `video: 'off'`. Não ligue `trace`/`video`/`screenshot: 'on'`. PASS → acabou; FAIL → trace e screenshot para investigação.
