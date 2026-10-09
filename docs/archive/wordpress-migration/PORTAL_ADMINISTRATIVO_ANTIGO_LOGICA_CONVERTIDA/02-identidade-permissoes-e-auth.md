# Identidade, papéis e autenticação

## Objetivo

Substituir roles/capabilities do WordPress por JWT do Node, com autorização **em cada rota admin**.

## O que o backend já tem

Registrado em `src/app.js` + `src/api/routes/auth.routes.js`:

| Método | Path | Contrato real hoje |
|---|---|---|
| POST | `/api/v1/auth/token` | Body `{ username, password }` (Zod). Resposta `{ token, user_email, user_nicename, user_display_name }` + cookie refresh HttpOnly |
| GET | `/api/v1/auth/me` | `{ user_email, user_nicename, user_display_name }` — **sem `userId`, sem `roles`, sem `permissions`**. Recusa conta `pending` (401) |
| POST | `/api/v1/auth/refresh` | Cookie + origin na allowlist CORS |
| POST | `/api/v1/auth/logout` | Revoga refresh; exige origin da loja |
| POST | `/api/v1/auth/register` + OTP | Signup da loja — **não** usar no portal |

Middleware: `buildBearerTokenMiddleware` em `/api/v1/*`. Sem Bearer, segue sem `currentUser`. JWT inválido → 403. Claim de identidade: `request.currentUser.id`.

Erro de login: `{ code, message, data: { status } }` — **não** `{ success: false, message }`. O `apiRequest` do SPA lê `errorBody.message`, então esse envelope ainda funciona.

## O que o SPA faz hoje (divergente)

Arquivo: `src/contexts/AuthContext.tsx`.

- `POST /auth/login` com `{ email, password }`, espera `{ accessToken, user? }`.
- `GET /auth/me` espera `{ userId, email, roles, permissions }`.
- Guarda `eden-bowls-admin-token` no `localStorage`.
- Não chama logout no backend.
- `RequireAuth` só exige token. Papéis filtram **menu**, não rota.
- `AdminRole` = `'admin' | 'operator' | 'readonly' | 'customer'` — **sem `nutritionist`**.

O backend **não tem** `POST /auth/login`. O validator **não aceita** o campo `email`; aceita `username` (que na prática é o e-mail do `wp_users.user_login` / lookup de autenticação).

## Conversão

### Login

**Adaptar o SPA** para o contrato já existente. Não criar `/auth/login` só por alias, a menos que queira um wrapper fino.

```
POST /api/v1/auth/token
{ "username": "<email>", "password": "…" }
```

No cliente:

```ts
const result = await apiRequest<{ token: string }>('/auth/token', {
  method: 'POST',
  body: { username: email, password },
})
localStorage.setItem(TOKEN_KEY, result.token)
```

Um único emitente de JWT (o mesmo da loja). O portal **não** usa o cookie refresh; o Bearer basta.

Opcional no backend: aceitar `email` como alias de `username` no validator, para o SPA não ter que remapear. Preferível no client.

### `/auth/me` para o portal

O payload da loja **não serve** para o admin. Duas opções válidas:

1. **Estender** `GET /api/v1/auth/me` com `userId`, `roles`, `permissions` (loja ignora campos extras).
2. **Criar** `GET /api/v1/admin/me` com o shape do SPA e manter `/auth/me` da loja intacto.

**Recomendado: opção 2.** O front da loja espera o envelope WP-like. Misturar roles no `/auth/me` da loja arrisca regressão.

Shape alvo do portal:

```ts
{
  userId: string
  email: string
  roles: Array<'admin' | 'operator' | 'nutritionist' | 'readonly' | 'customer'>
  permissions: string[]
}
```

Cliente com só `customer` (ou roles vazias) → `403` em qualquer `/admin/*` e no `GET /admin/me`.

Envelope de erro das rotas admin (para o `apiRequest` do SPA):

```json
{ "success": false, "message": "Forbidden." }
```

### Onde guardar o papel

Não existe tabela de roles Node hoje (`wp_users` + usermeta de OTP/`cus_`). Planejar uma destas:

- usermeta `_eden_admin_roles` JSON `["admin"]`, **ou**
- tabela `admin_users` (`user_id`, `roles` JSON), **ou**
- allowlist de e-mails no boot (`ADMIN_EMAILS=...`) só para o primeiro admin.

Criação de papel continua **fora da UI** no MVP (como no WP: roles no `init`). A tela Usuários nativa do WP não precisa de clone.

### Permissions de domínio (em vez de capabilities WP)

| Permission | Telas | WP equivalente |
|---|---|---|
| `nutrition.simulate` | Simulador | `access_pawbowl_nutrition` |
| `onboarding.read` | 360 lista/detalhe/CSV, dashboard de checkouts | `manage_woocommerce` |
| `shipping.read` / `shipping.write` | Frete | `manage_woocommerce` |
| `catalog.read` / `catalog.write` / `catalog.sync` | Produtos | `edit_products` + REST shop manager |
| `checkout.read` | Pedido/checkout detalhe | metabox onboarding |
| `checkout.status.write` | Só se o produto **decidir** mutar status (não existia no WP custom) | — |
| `billing.subscribers.read` | Ledger | `access_pawbowl_stripe` |
| `billing.subscribers.sync` | Reconcile / backfill / invoices | idem + AJAX |
| `billing.coupons.write` | Cupons 1ª compra | `access_pawbowl_stripe` |
| `users.read` / `users.delivery.write` | Clientes | `list_users` / `edit_user` |

Mapeamento papel → permissions:

| Papel | Permissions |
|---|---|
| `nutritionist` | `nutrition.simulate` |
| `operator` | todas as da tabela, **incluindo** `catalog.sync` (no WP o colaborador tinha sync) |
| `admin` | todas |
| `readonly` | só `*.read` + opcionalmente `nutrition.simulate` |

Assimetria WP a **não** copiar: o menu do simulador exigia `access_pawbowl_nutrition`, mas o render aceitava `manage_options`. No Node, `nutrition.simulate` basta.

### Middleware a criar

`requireAdminPermission(permission)` depois do bearer:

1. Sem `currentUser` → 401 `{ success: false, message }`.
2. Roles só `customer` ou vazias → 403.
3. Permission ausente no papel → 403.
4. Conta `pending` / `inactive` / `suspended` / `banned` → 403 (reusar `assertCriticalOperationAllowed`).

### Guardas de rota no SPA

Além do token (`RequireAuth`):

1. Sem papel operacional → tela “sem permissão”, não o shell completo.
2. `nutritionist` → rotas fora de `/nutrition/simulate` redirecionam.
3. Mutações escondidas (e rotas POST/PUT/PATCH bloqueadas) para `readonly`.
4. Incluir `nutritionist` em `AdminRole` e no menu.

### CSRF / cookie

O portal usa Bearer no `Authorization`. Não precisa do cookie refresh da loja. Logout local basta.

## O que não copiar

- Dois roles regionais iguais fingindo isolamento.
- `manage_options` como fallback solto.
- Esconder Posts/Temas/Plugins (não existem no SPA).
- Flexible Subscriptions / CPT.
- Frontend WP bloqueado (`pawbowl-admin-only-mode`).
- Atribuir papel pela UI no MVP.
