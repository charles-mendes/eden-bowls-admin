# Documentacao do Painel Administrativo PawBowl / Eden Bowl

Engenharia reversa das telas e regras customizadas do wp-admin, extraida do codigo-fonte atual. Objetivo: servir como especificacao funcional e tecnica para reimplementar o painel em outra stack, **sem copiar WordPress**.

## Escopo

Incluido:

- Telas customizadas dos plugins PawBowl (`headless-secure-registration`, `pawbowl-stripe-billing`, `custom-meal-plan-builder`).
- Must-use plugins que alteram roles, menus e acesso (`pawbowl-custom-roles.php`, `pawbowl-admin-only-mode.php`).
- Customizacoes nas telas nativas de Produto, Pedido e Usuario do WooCommerce/WordPress.
- Codigo administrativo existente mas **nao exposto no menu atual**.

Fora de escopo (nao reimplementar como copia):

- Telas padrao do WordPress Core (Posts, Midia, Plugins, Temas, Configuracoes).
- Telas padrao do WooCommerce que nao receberam logica PawBowl (relatorios nativos, marketing, setup wizard).
- Google Site Kit, JWT Auth admin, Price Based on Country UI nativa, Melhor Envio.

## Como ler

Cada tela segue o mesmo template. Sempre que uma regra aparecer, ela e classificada e marcada com:

- **[REGRA CONFIRMADA]** — implementada de forma explicita no codigo.
- **[INFERENCIA]** — deduzida do comportamento, sem enunciado de negocio isolado.
- **[DUVIDA]** — o codigo nao permite determinar com seguranca.

Classificacao de cada comportamento:

- Regra de negocio
- Regra de interface
- Validacao
- Integracao
- Persistencia
- Autenticacao/autorizacao
- Regra especifica do WordPress
- Regra especifica de plugin
- **Regra que deve ser preservada na nova aplicacao**

## Arquivos

| Arquivo | Conteudo |
|---|---|
| [01-visao-geral-e-mapa-de-telas.md](01-visao-geral-e-mapa-de-telas.md) | Mapa do menu, atores, fluxo de entrada |
| [02-permissoes-roles-e-acesso.md](02-permissoes-roles-e-acesso.md) | Roles, capabilities, visibilidade de menu |
| [03-simulador-nutricional.md](03-simulador-nutricional.md) | Eden Bowl Nutrition |
| [04-onboarding-360.md](04-onboarding-360.md) | Lista operacional de pedidos de onboarding |
| [05-frete.md](05-frete.md) | Configuracao BR (km) e US (fixo) |
| [06-pedido-woocommerce-customizacoes.md](06-pedido-woocommerce-customizacoes.md) | Metabox onboarding + resumo meal plan |
| [07-produto-woocommerce-customizacoes.md](07-produto-woocommerce-customizacoes.md) | Pais/dias do plano + sync Stripe |
| [08-stripe-assinantes.md](08-stripe-assinantes.md) | Ledger local de assinaturas e faturas |
| [09-stripe-cupons.md](09-stripe-cupons.md) | Cupons de 1a compra |
| [10-usuario-instrucoes-entrega.md](10-usuario-instrucoes-entrega.md) | Campo admin no perfil WP |
| [11-woocommerce-guardrails-admin.md](11-woocommerce-guardrails-admin.md) | Pagamentos WC ocultos, frontend bloqueado |
| [12-stripe-telas-nao-expostas.md](12-stripe-telas-nao-expostas.md) | Dashboard/webhooks/logs presentes no codigo, ausentes no menu |
| [13-regras-de-negocio-nova-stack.md](13-regras-de-negocio-nova-stack.md) | Somente regras a preservar na nova implementacao |

## Origem no codigo

Plugins custom:

- `wp/wp-content/plugins/headless-secure-registration`
- `wp/wp-content/plugins/pawbowl-stripe-billing`
- `wp/wp-content/plugins/custom-meal-plan-builder`

Must-use:

- `wp/wp-content/mu-plugins/pawbowl-custom-roles.php`
- `wp/wp-content/mu-plugins/pawbowl-admin-only-mode.php`

Documentacao auxiliar ja existente (nao substitui esta pasta):

- `headless-secure-registration/docs/ONBOARDING_360_ADMIN.md`
- `artefatos/documentacao-plugins-backend/`
- `artefatos/migracao-node-reverse-engineering/`
