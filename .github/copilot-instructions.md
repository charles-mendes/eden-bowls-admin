# Instruções globais

Estas regras se aplicam a qualquer alteração neste projeto.

## Contexto do projeto

- Painel administrativo em React + TypeScript, construído com Vite (porta 5174).
- Código de aplicação fica em `src/`.
- Páginas em `src/pages/`, layout e UI genérica em `src/components/`, HTTP em `src/lib/api.ts`, sessão em `src/contexts/AuthContext.tsx`, menu em `src/lib/menu.ts`.
- Testes unitários e de componentes ficam próximos ao código em `src/` quando existirem.
- Testes de integração ficam em `src/test/integration/` quando existirem.
- Testes E2E ficam em `e2e/specs/`; helpers compartilhados ficam em `e2e/helpers/` quando existirem.
- O backend (`eden-bowls-backend`) e a loja (`eden-bowls`) estão em workspaces separados e não devem ser alterados sem necessidade direta da tarefa.
- Visual: painel interno (sidebar + topbar, cinzas, um accent, IBM Plex Sans). Não copie a identidade visual da loja. Detalhes em `.agents/skills/frontend-design/SKILL.md`.
- Documentação do painel: `docs-new/` (fonte atual) e `docs/` (espelho). Não trate `docs-antigas/` como contrato vigente.

## Ferramentas de busca (já instaladas)

`rg`, `fd`, `tree` e `ast-grep` já estão instalados no ambiente local. Os comandos já funcionam. Use-os no terminal antes de ler arquivos. Não instale, não peça instalação e não substitua por `grep`, `find` ou `ls -R`.

1. Conteúdo: `rg "<padrão>" src` (ou `e2e`, `docs`, `docs-new`). Exemplo: `rg "hasPermission|RequireAuth|apiRequest" src`
2. Arquivos: `fd "admin"` ou `fd "\.test\.tsx$"`
3. Arquitetura: `tree -L 2 -I 'node_modules|dist|coverage|.git'`
4. Estrutura de código: `ast-grep -p '<padrão>' -l ts src` (ou `-l tsx`). Procura AST, não texto. Exemplo: `ast-grep -p 'apiRequest($$$)' -l ts src`

Leia um arquivo só depois de localizá-lo com `rg`/`fd`/`ast-grep`. Não abra dezenas de arquivos para descobrir estrutura, páginas, contextos, rotas, testes, types ou como um padrão de chamada é usado.

## Regras gerais

1. Antes de implementar, identifique o componente alvo, os padrões existentes e os testes relacionados.
2. Preserve a arquitetura, as APIs públicas, os papéis e as permissions existentes.
3. Faça a menor alteração necessária e não inclua refatorações fora do escopo.
4. Prefira bibliotecas e utilitários já existentes no projeto. Não adicione dependências automaticamente.
5. Não altere banco, infraestrutura, CI/CD ou configuração de produção sem necessidade indispensável e justificativa.
6. Nunca use testes desabilitados, `skip`, `only`, assertions removidas ou timeouts ampliados apenas para obter uma execução verde.
7. Quando um bug for encontrado, crie ou ajuste um teste que o reproduza sempre que tecnicamente possível.
8. Não solicite nem manipule credenciais, secrets ou tokens; pare e informe quando forem necessários.
9. Preserve alterações locais do usuário e não reverta mudanças não relacionadas.

## Validação obrigatória

Nunca rode tudo por padrão. Evite o fluxo `alterou 1 arquivo → npm test / npx playwright test → centenas de testes → centenas de linhas de saída`.

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

- Após alterar código, execute primeiro o teste mais rápido e específico capaz de detectar o problema.
- Use Vitest para regras, serviços, hooks, utilitários e componentes; use Playwright apenas para o fluxo de navegador afetado.
- Não execute `npm test`, `npm run test:all` nem `npx playwright test` sem arquivo após uma alteração pequena.
- Se Vitest ou Playwright ainda não existirem no `package.json`, não os instale só para validar uma alteração pequena.
- Quando uma alteração atravessar painel e backend, valide endpoint, método, headers, autenticação Bearer, payload, status, resposta e tratamento de erro.
- Escale a validação conforme o impacto: unitário, componente, integração e, quando aplicável, o spec Playwright do fluxo afetado.
- Informe ao final os arquivos alterados, testes executados, fluxos validados, problemas encontrados e o status.

## Vitest

Quando a config existir, o paralelismo de 4 threads deve ficar em `vite.config.ts`. Rode o recorte, não a suíte:

```bash
npx vitest run --related src/pages/UsersPage.tsx
npx vitest run -t "should load admin session"
npx vitest run --changed
```

`npm test` / `npx vitest run` sem recorte só em alteração de alto impacto.

## Playwright

Não rode `npx playwright test` nem `npm run test:e2e` a cada alteração. Não use `--ui` no fluxo do agente.

```bash
npx playwright test e2e/specs/admin-login.spec.ts --workers=4
npx playwright test e2e/specs/admin-users.spec.ts -g "loads customer detail" --workers=4
npx playwright test e2e/specs/admin-readonly.spec.ts --workers=4
```

Além do login, a suíte cobre listagem, detalhe, mutação e `readonly` em `e2e/specs/admin-users.spec.ts`, `admin-orders.spec.ts`, `admin-onboarding.spec.ts`, `admin-catalog.spec.ts`, `admin-billing.spec.ts` e `admin-readonly.spec.ts`. Vitest das telas fica em `src/pages/*.test.tsx`.

A suíte completa só em alteração estrutural ou de alto impacto. O reporter `line` deve ficar em `playwright.config.ts`.

Não gere artefatos gigantes na execução normal. Não use `trace: 'on'`, `video: 'on'` nem `screenshot: 'on'` — nem na config, nem via `--trace on` / `--video on` / `--screenshot on`. O padrão é `trace: 'retain-on-failure'`, `screenshot: 'only-on-failure'`, `video: 'off'`. PASS → acabou. FAIL → trace e screenshot ficam para investigação.

## Execução paralela obrigatória de testes

Quando testes forem executados, a execução é paralela com 4 workers.

- Ao rodar um subconjunto: `npx playwright test <arquivo> --workers=4`.
- É proibido `--workers=1`, `--maxWorkers=1`, `--no-file-parallelism`, `--poolOptions.threads.singleThread` ou qualquer flag que serialize a execução.
- Se um teste só passa em execução serial, isso é um bug de isolamento. Corrija o teste; não reduza o paralelismo.
- `--headed`, `--debug` e `--ui` são só para o desenvolvedor investigar localmente. O agente não deve usá-los. Se forem usados, informe que a execução foi serial e repita a validação final em paralelo com 4 workers.

## Critério de conclusão

Considere a tarefa concluída somente quando:

- a implementação estiver realizada dentro do escopo;
- os testes relacionados tiverem sido identificados e executados (não a suíte completa, salvo alto impacto), ou a ferramenta de teste ainda não existir no projeto;
- a última execução de validação, quando houver testes, tiver sido feita em paralelo com 4 workers;
- não houver erro conhecido relacionado à alteração;
- nenhuma cobertura tiver sido removida para obter sucesso;
- nenhuma dependência ou alteração arquitetural desnecessária tiver sido adicionada.
