# Guardrails administrativos WooCommerce / WordPress

Estas nao sao "telas de produto", mas alteram o que o operador ve e pode fazer no painel padrao. Precisam ser conhecidas na migracao para nao reintroduzir fluxos que o codigo atual **bloqueia de proposito**.

---

## 1) Modo admin-only (frontend desligado)

Arquivo: `wp/wp-content/mu-plugins/pawbowl-admin-only-mode.php`

**[REGRA CONFIRMADA]** `template_redirect` prioridade 0:

- Ignora admin, ajax, cron, REST.
- Logado → `admin_url()`
- Anonimo → `wp_login_url(admin_url())`

Classificacao: regra especifica do WordPress / modo de deploy headless. **Nao e regra de negocio PawBowl.** Na nova stack, simplesmente nao existe loja WP.

---

## 2) Aba Payments do WooCommerce oculta

Arquivo: `pawbowl-stripe-billing/src/class-plugin.php` → `register_woocommerce_payments_tab_guard`

**[REGRA CONFIRMADA]**

- Remove tabs `checkout`, `payment_gateways`, `payments` de `woocommerce_settings_tabs_array`.
- Remove submenus equivalentes.
- `admin_init`: se `page=wc-settings` e tab ∈ {checkout, payment_gateways, payments} → redirect para `admin.php?page=wc-settings`.

Intencao: pagamento vive na Stripe (headless), nao no gateway Woo. **Preservar a intencao** (nao oferecer configuracao de gateway Woo como caminho operacional). Nao copiar o hack de menu.

---

## 3) Flexible Subscriptions escondido para nao-admin

Ver [02-permissoes-roles-e-acesso.md](02-permissoes-roles-e-acesso.md).

Intencao: operadores usam o ledger Stripe PawBowl, nao o CPT `fsb_subscription`.

**[INFERENCIA]** Admin ainda pode abrir o CPT (util para debug). Nao ha tela PawBowl equivalente a "editar Flexible Subscription".

---

## 4) Pedidos sempre sob o menu WooCommerce

Colaboradores nao devem ver Pedidos como top-level. O mu-plugin remove top-level `shop_order` / `wc-orders` e injeta submenu se faltar.

Regra de interface WP. Na nova stack: Pedidos no modulo Operacoes.

---

## 5) Roles WP nativos escondidos

Shop manager, author, editor, subscriber, contributor nao aparecem no seletor. Melhor Envio suporte e removido.

---

## 6) Bridge de teste de assinatura

Plugin `hsr-flexible-subscriptions-bridge` expoe REST de seed/checkout de teste. **Nao registra menu admin.** Nao documentar como tela operacional. E ferramenta de teste, nao painel.
