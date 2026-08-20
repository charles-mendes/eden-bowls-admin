# Eden Bowls Admin

Painel operacional em React + TypeScript (Vite, porta 5174). Consome `eden-bowls-backend` em `/api/v1`.

## Desenvolvimento

```bash
npm install
npm run dev
```

O proxy local encaminha `/api` para `http://127.0.0.1:3000`. Para apontar a outro host:

```bash
VITE_ADMIN_API_BASE_URL=http://127.0.0.1:3000/api/v1 npm run dev
```

## Docker (QA)

O painel sobe em `https://edenbowls.com/qa-admin`, atrás do Caddy público.

```bash
cp .env.qa.example .env
docker compose --env-file .env -f docker-compose.admin.yml up -d --build
```

O reverse proxy deve encaminhar `https://edenbowls.com/qa-admin/*` para `127.0.0.1:4174`. `VITE_*` entra na imagem no build: se mudar `.env`, use `--build`.

## Autenticação

- Login: `POST /api/v1/auth/token` com `{ username, password }` (`username` é o e-mail)
- Perfil: `GET /api/v1/admin/me`
- Token em `localStorage` na chave `eden-bowls-admin-token`
- Contas só `customer` não entram no shell

## Testes

Nunca rode a suíte inteira depois de uma alteração pequena.

```bash
npx vitest run --related src/pages/UsersPage.tsx
npx vitest run -t "should load admin session"
npx vitest run --changed
npx playwright test e2e/specs/admin-login.spec.ts --workers=4
```

`npm test` / `npm run test:e2e` só em alteração de alto impacto. Playwright usa `trace: retain-on-failure`, `screenshot: only-on-failure` e `video: off`.
