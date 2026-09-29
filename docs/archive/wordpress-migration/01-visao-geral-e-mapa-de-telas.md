# Visao geral e mapa de telas do painel administrativo

## Objetivo do painel atual

O wp-admin e o **unico ponto de entrada operacional** deste WordPress. O frontend publico e redirecionado para login/admin. Operadores usam o painel para:

1. Validar recomendacao nutricional de um pet.
2. Inspecionar pedidos de onboarding (cliente, pets, plano, Stripe).
3. Configurar regras de frete BR/US.
4. Cadastrar produtos de plano alimentar e sincroniza-los com a Stripe.
5. Operar assinaturas a partir de um ledger local (nao da Stripe em tempo real na listagem).
6. Mapear cupons de 1a compra na Stripe.

**[REGRA CONFIRMADA]** `pawbowl-admin-only-mode.php` intercepta `template_redirect` e redireciona qualquer request de frontend para `wp-login.php` (anonimo) ou `admin_url()` (logado). REST, AJAX, cron e wp-admin nao sao afetados.

Classificacao: Autenticacao/autorizacao + regra especifica do WordPress. **Nao e regra de negocio do produto PawBowl** — e um modo de operacao do WP atual (headless). Na nova stack, o painel e a API serao aplicacoes distintas; o redirecionamento de loja WP nao precisa ser copiado.

## Atores

| Ator | Role WP | Uso principal |
|---|---|---|
| Administrador | `administrator` | Acesso total, inclusive Flexible Subscriptions e Stripe |
| Colaborador Brasil | `eden_bowls_colaborador_brasil` | WooCommerce (pedidos, clientes, cupons, produtos), Nutrition, Frete, Onboarding 360, Stripe |
| Colaborador EUA | `eden_bowls_colaborador_estados_unidos` | Identico ao colaborador Brasil |
| Nutricionista | `nutricionista` | Somente o Simulador Nutricional |

**[REGRA CONFIRMADA]** Os dois roles regionais recebem o **mesmo conjunto de capabilities**. Nao ha filtro de pais/mercado nas queries das telas admin. A distincao Brasil/EUA e apenas rotulo de role.

**[DUVIDA]** Se a intencao de negocio era isolar dados por mercado, isso **nao esta implementado**. Nao inventar isolamento na documentacao do sistema atual.

## Como o usuario chega ao painel

```
Entrada (URL do site)
  → se nao autenticado: redirect para wp-login.php?redirect_to=admin
  → se autenticado: redirect para /wp-admin/
  → menus visiveis dependem do role (ver 02-permissoes)
```

Nao ha dashboard PawBowl customizado como home. A home e o dashboard nativo do WordPress (e WooCommerce Admin para quem tem `manage_woocommerce`).

## Mapa de menus customizados (o que realmente aparece)

Menus top-level registrados pelos plugins PawBowl:

| Menu | Slug | Capability do menu | Pagina |
|---|---|---|---|
| Eden Bowl Nutrition | `hsr-nutrition-simulator` | `access_pawbowl_nutrition` | Simulador |
| — Onboarding 360 | `hsr-onboarding-360` | `manage_woocommerce` | Lista/detalhe/CSV |
| — Frete | `hsr-shipping` | `manage_woocommerce` | Config BR/US |
| Stripe | `pawbowl-stripe-subscriptions` | `access_pawbowl_stripe` | Assinantes (lista/detalhe) |
| — Assinantes | mesmo slug | `access_pawbowl_stripe` | idem |
| — Cupons | `pawbowl-stripe-coupons` | `access_pawbowl_stripe` | Mapeamento 1a compra |
| — (alias oculto) | `pawbowl-stripe-dashboard` | `access_pawbowl_stripe` | Renderiza a **mesma** pagina de assinantes |

Telas nativas customizadas (nao sao menus novos):

| Tela nativa | Customizacao PawBowl |
|---|---|
| Produto WooCommerce | Pais/dias do meal plan; metabox Stripe sync; badges de variacao; bloqueio de publish |
| Pedido WooCommerce | Metabox Onboarding Summary; linhas de desconto/pago Stripe; coluna Meal Plan |
| Perfil de usuario WP | Textarea Delivery Instructions |
| WooCommerce → Settings | Abas Payments/Checkout removidas e redirecionadas |

## Telas com codigo mas sem menu

`StripeAdminModule` contém `render_dashboard_page`, `render_settings_page`, `render_webhooks_page`, `render_logs_page`, `render_events_page`, `render_diagnostics_page`. **Nenhum desses slugs e registrado em `register_admin_menu()` no estado atual.** Ver [12-stripe-telas-nao-expostas.md](12-stripe-telas-nao-expostas.md).

Classificacao: regra especifica do WordPress / divida de produto. **[REGRA CONFIRMADA]** o menu atual expoe so Assinantes + Cupons.

## O que o operador **nao** faz neste painel

Nao ha, nas telas customizadas atuais:

- CRUD de sessao de onboarding (corrigir pet, retomar sessao, reenviar token).
- Pausar / cancelar / alterar frequencia de assinatura pelo admin (acoes de assinatura existem na REST para o **app do cliente**, nao nestas telas).
- CRUD de racas.
- Editor das tabelas de fator nutricional (fatores estao hardcoded no servico).
- Criacao de pedido/assinatura pelo admin (isso e o checkout headless).

**[INFERENCIA]** O painel atual e majoritariamente **consulta + configuracao + sincronizacao**, nao um backoffice transacional completo.

## Inventario de persistencia usada pelo admin

| Origem | Uso no admin |
|---|---|
| Option `hsr_shipping_settings` | Frete |
| Option `pawbowl_stripe_first_purchase_promos` | Mapa promo 1/3/6 meses |
| Option `pawbowl_stripe_admin_settings` | Chaves Stripe da UI (nao usadas no runtime) |
| Option `pawbowl_stripe_webhook_admin_settings` | Toggles de evento (UI nao menuada) |
| Options de observabilidade/historico webhook | Dashboard/logs nao menuados |
| Tabelas `wp_hsr_stripe_*` | Lista/detalhe de assinantes |
| Tabelas `wp_hsr_onboarding_*` / `wp_hsr_breeds` | Recomendacao simplificada no Onboarding 360; racas no simulador |
| Order meta `_hsr_*` | Onboarding 360 e metabox de pedido |
| Product meta `_cmpb_*`, variation meta `_stripe_*` | Tela de produto |
| User meta `_eden_delivery_instructions` | Perfil WP |

## Dependencias globais do painel

- WordPress Core (admin, roles, nonces, options, usermeta).
- WooCommerce (produtos variaveis, pedidos, `wc_get_orders`, `manage_woocommerce`).
- Action Scheduler (reconcilicao Stripe em background).
- Stripe SDK + env `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` (runtime).
- ViaCEP, Nominatim, OSRM (teste de CEP na tela de Frete).
- Plugin Flexible Subscriptions (`fsb_subscription`) — menu oculto para nao-admin.
