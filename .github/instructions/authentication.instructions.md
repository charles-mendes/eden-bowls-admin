---
applyTo: "src/**/*.{ts,tsx},e2e/**/*"
description: "Use when changing admin authentication, roles, permissions, bearer tokens, or operational access to /admin routes."
---

# Autenticação e autorização do painel

Este SPA é o portal administrativo. Não copie o modelo de sessão da loja (`eden-bowls`).

## Contrato

- Login: `POST /api/v1/auth/token` com `{ username, password }`. O campo `username` é o e-mail. Não crie `POST /auth/login` só por alias.
- Perfil operacional: `GET /api/v1/admin/me` com Bearer. Shape: `{ userId, email, roles, permissions }`.
- Não use `GET /api/v1/auth/me` da loja (envelope WP-like, sem papéis do painel).
- Toda chamada autenticada usa `Authorization: Bearer <token>`.
- Base HTTP: `import.meta.env.VITE_ADMIN_API_BASE_URL ?? '/api/v1'`, via `apiRequest` em `src/lib/api.ts`.
- Não use `POST /auth/register`, OTP, cookie refresh da loja nem rotas `/api/v1/onboarding/session/...` como sessão do painel.

## Persistência

- O access token fica em `localStorage` na chave `eden-bowls-admin-token`.
- Não grave perfil (`user`, `roles`, `permissions`) em `localStorage`, `sessionStorage`, IndexedDB ou cookie acessível por JavaScript.
- Bootstrap: com token, chame `GET /admin/me`. Falha → apague o token e zere a sessão.
- Logout remove o token local. Não invente um fluxo de refresh cookie para o painel.

## Papéis e acesso

Papéis operacionais: `admin`, `operator`, `nutritionist`, `readonly`. `customer` não entra no shell.

- `RequireAuth` exige token **e** usuário operacional. Token sozinho não basta.
- `nutritionist` sem `admin`/`operator` permanece em `/nutrition/simulate`.
- Menu em `src/lib/menu.ts` filtra por `roles`. Esconder o item não autoriza a rota: a URL ainda precisa respeitar o papel.
- Mutações de `readonly` ficam ocultas na UI. A autorização real é o middleware `requireAdminPermission` no backend.
- Permissions de domínio (exemplos): `nutrition.simulate`, `onboarding.read`, `shipping.read`/`shipping.write`, `catalog.read`/`catalog.write`/`catalog.sync`, `checkout.read`, `billing.subscribers.read`/`billing.subscribers.sync`, `billing.coupons.write`, `users.read`/`users.delivery.write`, `users.roles.write`.
- Não atribua papéis pela UI no MVP, salvo a tela `/users/roles` já existente para `admin`.

Ao alterar login, `AuthContext`, `RequireAuth`, menu ou rotas `/admin/*`, teste: conta `customer` bloqueada, bootstrap por `/admin/me`, Bearer nas chamadas, `nutritionist` restrito e `readonly` sem mutações visíveis.

Camadas esperadas além do login:

- Vitest: `src/pages/LoginPage.test.tsx`, `src/routes/RequireAuth.test.tsx`, `src/contexts/AuthContext.test.tsx`, `src/lib/roles.test.ts`, `src/lib/menu.test.ts`, `src/test/integration/auth-shell.test.tsx`, `src/test/integration/readonly-shell.test.tsx`.
- Playwright: `e2e/specs/admin-login.spec.ts` e `e2e/specs/admin-readonly.spec.ts`.
- Mutações visíveis só com permission (`users.delivery.write`, `catalog.write`, `catalog.sync`, `shipping.write`, `billing.subscribers.sync`, `users.roles.write`). A autorização real continua no backend.
