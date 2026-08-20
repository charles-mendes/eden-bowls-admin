# AGENTS.md

## Ferramentas de busca (já instaladas)

`rg`, `fd`, `tree` e `ast-grep` já estão instalados no ambiente local. Os comandos já funcionam. Use-os no terminal antes de ler arquivos. Não instale, não peça instalação e não substitua por `grep`, `find` ou `ls -R`.

1. Conteúdo: `rg "<padrão>" src` (ou `e2e`, `docs`, `docs-new`). Exemplo: `rg "hasPermission|RequireAuth|apiRequest" src`
2. Arquivos: `fd "admin"` ou `fd "\.test\.tsx$"`
3. Arquitetura: `tree -L 2 -I 'node_modules|dist|coverage|.git'`
4. Estrutura de código: `ast-grep -p '<padrão>' -l ts src` (ou `-l tsx`). Procura AST, não texto. Exemplo: `ast-grep -p 'apiRequest($$$)' -l ts src`

Leia um arquivo só depois de localizá-lo com `rg`/`fd`/`ast-grep`. Não abra dezenas de arquivos para descobrir estrutura, páginas, contextos, rotas, testes, types ou como um padrão de chamada é usado.

## Testes: nunca rode a suíte inteira por padrão

Após alterar código, descubra os testes relacionados, rode só eles, corrija falhas e só então amplie o escopo. Não use `npm test`, `npm run test:all` nem `npx playwright test` sem arquivo após uma alteração pequena.

For frontend changes:
1. Run the related Vitest tests first.
2. Do not run the entire test suite unless necessary.
3. Use --related or --changed whenever possible.

```bash
npx vitest run --related src/pages/UsersPage.tsx
npx vitest run -t "should load admin session"
npx vitest run --changed
npx playwright test e2e/specs/admin-login.spec.ts --workers=4
npx playwright test e2e/specs/admin-users.spec.ts -g "loads customer detail" --workers=4
npx playwright test e2e/specs/admin-readonly.spec.ts --workers=4
```

Listagem, detalhe, mutação e `readonly` têm spec próprio (`admin-users`, `admin-orders`, `admin-onboarding`, `admin-catalog`, `admin-billing`, `admin-readonly`). Não cubra só login.

Se Vitest ou Playwright ainda não existirem no `package.json`, não instale nem rode a suíte só para cumprir esta regra. Só adicione a ferramenta se a tarefa for configurar testes.

Não use `npx playwright test --ui` no fluxo do agente. Mantenha 4 workers. Não ligue `trace`/`video`/`screenshot: 'on'` nem `--trace on`: a config deve usar `retain-on-failure`, `only-on-failure` e `video: 'off'`. PASS → acabou; FAIL → artefatos para investigação. Detalhes em `.github/instructions/testing.instructions.md` e `.github/instructions/playwright.instructions.md`.

## Visual do painel

- O painel é uma ferramenta interna (Linear / Stripe Dashboard / Vercel), não a loja. Não copie paleta, fontes, texturas nem copy da `eden-bowls`.
- Siga `.agents/skills/frontend-design/SKILL.md`: um grotesk só, cinzas neutros, um accent para ação/estado ativo, cores semânticas só para status, shell sidebar + topbar, densidade e consistência.
- Não use Tenor Sans, Figtree, Quicksand, parchment/moss/clay, grain, gradient mesh nem layout assimétrico de marketing.

## Coding Guardrails

- Preserve a arquitetura do SPA: páginas em `src/pages/`, layout em `src/components/`, HTTP em `src/lib/api.ts`, sessão em `src/contexts/AuthContext.tsx`, menu em `src/lib/menu.ts`.
- Não adicione TanStack Query, SWR, form library nem cliente HTTP de terceiros sem pedido explícito. Continue usando `apiRequest`.
- Não adicione flags de bypass como `validationsEnabled` em fluxos do painel.
- Não pule auth, papéis ou permissions em handlers de submit, rotas ou `RequireAuth`.
- Preserve autenticação, papéis e permissions existentes, salvo pedido explícito para mudar o comportamento de negócio.
- O backend (`eden-bowls-backend`) e a loja (`eden-bowls`) são workspaces separados. Não os altere sem necessidade direta da tarefa.

## Auth e autorização

- Login: `POST /api/v1/auth/token` com `{ username, password }` (`username` é o e-mail). Não invente `POST /auth/login`.
- Perfil do painel: `GET /api/v1/admin/me`. Não use o `GET /auth/me` da loja.
- Toda chamada autenticada usa `Authorization: Bearer <token>`.
- Conta só `customer` (ou sem papel operacional) não entra no shell.
- `nutritionist` sem `admin`/`operator` fica em `/nutrition/simulate`.
- Mutações de `readonly` devem permanecer escondidas na UI; a autorização real é o middleware do backend.
- Não reconstrua sessão a partir do perfil persistido. Só o token em `eden-bowls-admin-token`; o perfil vem de `/admin/me`.
