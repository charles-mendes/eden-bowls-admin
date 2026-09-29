# Clientes e instruções de entrega

## Origem WP

Campo no perfil WP: textarea **Delivery Instructions** → user meta `_eden_delivery_instructions`. Mesmo dado do app `PUT /custom/v1/profile/delivery`.

Não havia tela PawBowl de listagem de clientes além do Woo “Customers”. Save exigia nonce `hsr_delivery_instructions` + `edit_user`. Nonce inválido = **silêncio** (não grava, não notice) — no Node, 401/403 explícito.

Texto da UI: “Special instructions for delivery drivers, gate code, preferred drop-off location, or pet safety notes.”

## O que o backend já tem

Rotas do **próprio** JWT — **registradas** em `src/app.js` via `registerProfileRoutes` (`src/api/routes/profile.routes.js`):

| Método | Path | Quem opera |
|---|---|---|
| GET | `/api/v1/profile` | `currentUser.id` |
| PUT/PATCH | `/api/v1/profile/personal` | idem |
| PUT/PATCH | `/api/v1/profile/delivery` | idem — merge `address.delivery_instructions` |
| PUT/PATCH | `/api/v1/profile/email` | idem |
| PUT/PATCH | `/api/v1/profile/password` | idem |
| POST | `/api/v1/profile/avatar` | idem |
| DELETE | `/api/v1/profile` | idem; bloqueia se houver sub `active`/`trialing` |

Instruções: `onboarding_user_state.address.delivery_instructions` (`ProfileService.updateDelivery`). Checkout também grava via `POST /api/v1/onboarding/address`.

Usuários: `wp_users` (`ID`, `user_login`, `user_email`, `display_name`, …) + `wp_usermeta` + `activation_status` no fluxo de auth.

**Não há** `GET /admin/users`. O SPA `/users` (`UsersPage.tsx`) chama `GET /admin/users?skip&take` — contrato assumido, rota ausente. Sem busca, sem detalhe.

A doc `eden-bowls-backend/docs-new/profile/README.md` ainda diz que `/profile*` retorna 404. Isso está **desatualizado**: as rotas já estão no `app.js`. O que continua verdadeiro: o service **não** aceita `userId` alvo.

## Regras a preservar

1. Instruções = texto livre sanitizado (mesmo campo do app). Empty string = apagar.
2. Operador edita no detalhe do cliente; o cliente edita no app.
3. Sem regra extra de tamanho além de sanitize/trim (alinhar com `ProfileService`).
4. E-mail/senha/avatar **não** precisam de telas admin custom no MVP (o WP nativo cobria; o portal não é CMS). Reset de senha pelo admin = requisito novo.
5. Não usar `DELETE /profile`, change-email, change-password nem avatar do JWT admin para operar outra conta.
6. Não expor PATCH de papéis nesta tela no MVP.

## UI alvo

- `/users` — lista (já existe). Unificar paginação em `page`/`perPage` (o resto do admin já usa isso; hoje a tela usa `skip`/`take`).
- `/users/:userId` — **criar**: identidade + endereço + textarea instruções + atalhos para 360 e ledger.

Lista: e-mail, status da conta (`activation_status`), nome (`display_name` / profile.fullName), telefone, `createdAt`. Busca por e-mail/nome (o WP tinha; o SPA atual não).

## Rotas backend

### Não reutilizar `/profile*` com JWT admin

O service lê `request.currentUser.id`. Um admin autenticado atualizaria **o próprio** perfil.

### Criar

```
GET   /api/v1/admin/users
GET   /api/v1/admin/users/:userId
PATCH /api/v1/admin/users/:userId/delivery-instructions
```

Permissions: `users.read` / `users.delivery.write`.

Lista query: `page`, `perPage`, `q` (email/nome). Envelope:

```ts
{
  total: number
  page: number
  perPage: number
  items: Array<{
    id: string
    email: string
    status: string
    createdAt: string
    profile: { fullName: string | null; phone: string | null } | null
  }>
}
```

Detalhe: profile + `address` (sem senha, sem hash) + flags de assinatura no ledger (`active`/`trialing` count) + `deliveryInstructions`.

PATCH instruções:

```json
{ "deliveryInstructions": "deixar na portaria" }
```

Reusar o merge de `address` do `ProfileService.updateDelivery` / `OnboardingZipcodeRepository`, **parametrizado por `userId` alvo**. Esse é o único gap de implementação no service (hoje o método não recebe o alvo).

Não listar `customer` vs admin na mesma tabela com ações de papel. Filtro opcional `role=customer` se a allowlist de admins existir.

## Relação com o SPA atual

| Contrato SPA | Destino |
|---|---|
| `GET /admin/users?skip&take` | `page` / `perPage` |
| Sem detalhe | criar `/users/:id` |
| Sem busca | query `q` |
| Sem mutação | PATCH instruções |

Adapter no front: `skip = (page-1)*perPage` só se o backend antigo for mantido; preferir mudar os dois lados juntos.

## O que não copiar

- Roles WP `shop_manager` / `author` escondidos na UI — irrelevante.
- Save silencioso se nonce falhar.
- Editar o usuário WP “por dentro” do CMS.
- CRUD de avatar/e-mail/senha no admin no MVP.
- Usar as rotas `/profile*` da loja como se fossem admin.
