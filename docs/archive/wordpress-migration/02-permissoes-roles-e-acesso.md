# Permissoes, roles e visibilidade de menu

## Nome da funcionalidade

Controle de acesso do painel administrativo PawBowl.

## Objetivo

Definir quem entra no wp-admin, quais menus ve e quais acoes pode executar nas telas customizadas.

Problema de negocio: separar administrador, operacao regional e nutricionista, sem expor ferramentas de CMS (posts, temas, plugins) para colaboradores.

Atores: todos os usuarios do wp-admin.

## Pre-condicoes

- Usuario autenticado no WordPress.
- Roles criadas no `init` pelo mu-plugin `pawbowl-custom-roles.php`.

## Fluxo principal

1. `init` registra/atualiza roles customizadas e concede capabilities ao `administrator`.
2. `admin_menu` (prioridades 999–1002) remove menus conforme o role.
3. Cada pagina customizada revalida capability no callback de render (nao confia so no registro do menu).

## Roles e capabilities

### administrator

**[REGRA CONFIRMADA]** Recebe `access_pawbowl_nutrition` e `access_pawbowl_stripe` via `add_cap` no `init`.

Tambem possui as capabilities nativas de admin (`manage_options`, `manage_woocommerce`, etc.).

E o unico role que **mantem** o menu Flexible Subscriptions.

### eden_bowls_colaborador_brasil / eden_bowls_colaborador_estados_unidos

Base: clone das caps de `contributor` + extras:

```
manage_woocommerce
view_woocommerce_reports
view_admin_dashboard
list_users, create_users
edit/publish/read_private products e terms
edit/publish/read shop_orders
edit/read shop_coupons
access_pawbowl_nutrition
access_pawbowl_stripe
```

**[REGRA CONFIRMADA]** Os dois slugs recebem **exatamente as mesmas caps**. Nao ha `if (brasil)` vs `if (eua)` em query, filtro de pedido, produto ou assinatura.

**[INFERENCIA]** Os nomes existem para organizacao humana (quem atende qual mercado). Nao ha enforcement tecnico de mercado.

Menus removidos para colaborador (por slug e/ou titulo visivel):

- Posts, Midia, Comentarios
- Relatorios Woo (`wc-reports`)
- Marketing
- Pagamentos (titulo)
- Flexible Subscriptions (titulo e submenu)
- Aparencia, Plugins, Ferramentas, Configuracoes

Menus WooCommerce permitidos (por titulo/slug): Orders, Customers, Coupons, e o item `wc-admin`.

**[REGRA CONFIRMADA]** Se o submenu Pedidos nao existir, o codigo injeta um item `pawbowl-orders` que apenas redireciona para `admin.php?page=wc-orders`.

### nutricionista

Caps **somente**:

```
read
level_0
access_pawbowl_nutrition
```

**[REGRA CONFIRMADA]** Qualquer outra cap concedida e removida no `init` (o role e "esticado" para o conjunto minimo).

**[REGRA CONFIRMADA]** No `admin_menu` prioridade 1000, todos os menus top-level sao apagados, restando so `hsr-nutrition-simulator`. Submenus Onboarding 360 e Frete tambem sao removidos para este role (mesmo que o usuario hipoteticamente tivesse `manage_woocommerce`, o que nao tem).

**[REGRA CONFIRMADA]** Filtro `woocommerce_prevent_admin_access` retorna `false` para nutricionista, para o WooCommerce nao expulsar o usuario do wp-admin (o role nao tem caps Woo).

### Roles escondidos da UI de usuarios

**[REGRA CONFIRMADA]** `editable_roles` e `views_users` removem: `shop_manager`, `author`, `editor`, `subscriber`, `contributor`.

Nao significa que esses roles deixam de existir no WP; apenas nao aparecem no seletor/listagem.

### Roles de terceiros removidos

**[REGRA CONFIRMADA]** Role `melhor-envio-equipe-suporte` e removido no `init`, inclusive de mapas de capability de usuarios ja existentes.

## Capabilities usadas pelas telas customizadas

| Tela | Capability do menu | Revalidacao no render |
|---|---|---|
| Simulador nutricional | `access_pawbowl_nutrition` | `access_pawbowl_nutrition` **ou** `manage_options` |
| Onboarding 360 | `manage_woocommerce` | `manage_woocommerce` **ou** `manage_options` |
| Frete | `manage_woocommerce` | `manage_woocommerce` **ou** `manage_options` |
| Stripe Assinantes / Cupons | `access_pawbowl_stripe` | `access_pawbowl_stripe` + `is_user_logged_in()` |
| Metabox Onboarding no pedido | (metabox so registra se) `manage_woocommerce` **ou** `manage_options` | — |
| Metabox Stripe no produto | n/a | `edit_post` do produto |
| Instrucoes de entrega no usuario | n/a | `edit_user` no save |
| REST sync Stripe | n/a | `manage_woocommerce` **ou** `manage_options` (`require_shop_manager`) |

**[REGRA CONFIRMADA]** Ha assimetria: o menu do simulador exige `access_pawbowl_nutrition`, mas o render aceita `manage_options` como fallback. Nutricionista nao tem `manage_options`; admin tem ambos.

**[REGRA CONFIRMADA]** REST de sync (`POST /custom/v1/sync-stripe-products/{id}`) exige `manage_woocommerce`/`manage_options`, **nao** `access_pawbowl_stripe`. Um usuario so com cap Stripe (se existisse) nao sincronizaria produto. Na pratica, colaboradores tem as duas.

## Hide de Flexible Subscriptions

**[REGRA CONFIRMADA]** Para qualquer usuario que **nao** seja `administrator`, o codigo remove:

- submenu `edit.php?post_type=fsb_subscription`
- paths `wc-admin&path=/subscriptions`
- menu top-level do CPT `fsb_subscription`

Classificacao: Autenticacao/autorizacao + regra especifica de plugin. **Preservar a intencao**: assinatura operacional vive no modulo Stripe PawBowl, nao no CPT Flexible, para operadores.

## Frontend bloqueado

Ver [11-woocommerce-guardrails-admin.md](11-woocommerce-guardrails-admin.md).

## CRUD de roles no painel

Nao ha tela PawBowl para criar roles. A criacao e **codigo + `init`**. Atribuicao de role a usuario e a tela nativa de Usuarios do WP, com a lista filtrada.

## Observacoes para migracao

- Modelar **tres perfis**: Admin, Operador, Nutricionista.
- Nao copiar dois operadores (BR/US) ate existir regra real de isolamento; hoje sao o mesmo perfil.
- Capabilities WP (`manage_woocommerce`, `edit_post`) devem virar permissoes de dominio: `nutrition.simulate`, `onboarding.read`, `shipping.write`, `billing.subscribers.read`, `catalog.product.sync`, `users.delivery_instructions.write`.
- Sempre revalidar permissao no backend de cada acao (o WP ja faz isso no render e no AJAX/REST).
