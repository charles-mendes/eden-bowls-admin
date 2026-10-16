# Stripe Assinantes

## Nome da funcionalidade

Stripe → Assinantes (titulo da pagina: **Assinaturas**).

Menu: **Stripe** / **Assinantes** (`admin.php?page=pawbowl-stripe-subscriptions`).  
Alias de bookmark: `page=pawbowl-stripe-dashboard` renderiza a **mesma** pagina (submenu oculto).

Codigo:

- `class-stripe-admin-module.php` (menu)
- `class-stripe-subscriptions-page.php` (lista, detalhe, AJAX)
- `class-stripe-subscriptions-list-table.php`
- Ledger: `class-stripe-ledger-schema.php` + `StripeSubscriptionService`

## Objetivo

Operar assinaturas a partir de um **ledger local** alimentado por webhooks/reconcilicao, **sem consulta sincronica a Stripe na listagem**.

Problema de negocio: ver quem esta ativo, em atraso, cancelando, MRR, faturas e frete recorrente auditado, e forcar sync quando o ledger atrasar.

Atores: usuarios com `access_pawbowl_stripe` (Admin e Colaboradores).

## Pre-condicoes

- Tabelas `wp_hsr_stripe_*` migradas.
- Runtime Stripe configurado no **ambiente** para acoes que chamam a API (sync invoices, PDF, reconcilicao).
- Action Scheduler ou WP-Cron para sync em fila.

## Fluxo principal — lista

1. GET pagina. Filtro de status **default `active`** se `status` nao vier na query **[REGRA CONFIRMADA]**.
2. Cards de KPI (ver regras; varios **ignoram** o filtro de status da lista).
3. Toolbar: Status, Busca, Filtrar, Limpar (Limpar forca `status=active` de novo), Vincular assinaturas ao usuario, Executar sincronização agora.
4. Tabela paginada 10–50 (default 20).
5. Acoes por linha: Ver no Stripe (nova aba), Ver detalhes.

Nao ha criar assinatura, pausar, cancelar ou alterar plano nesta UI.

## Fluxo detalhe

GET `view=detail&subscription_id=sub_...`

Se nao achar no ledger: "Assinatura nao encontrada no ledger local." + Voltar.

Secoes:

- Cabecalho: cliente, plano, status badge, renovacao, cancelamento agendado, price id
- Botoes: Abrir no Stripe, Ver cliente no Stripe, Vincular este cliente, Sincronizar invoices desta assinatura
- Historico de faturas locais + Stripe + Baixar PDF
- Frete recorrente auditado (filtro + CSV)
- Pedidos Woo vinculados (`wp_hsr_stripe_orders`)

## Acoes e o que acontece depois

| Acao | Transporte | Processamento | Saida |
|---|---|---|---|
| Executar sincronização agora | AJAX `pawbowl_stripe_sync_subscriptions_run_now` | `process_reconciliation_job({trigger: manual_admin_run_now})` **no request atual** | notice + reload 700ms |
| Agendar sync (botao legado `pawbowl-stripe-sync-ledger`, pode nao estar visivel) | AJAX ou admin-post | Action Scheduler `hsr_stripe_reconcile_subscriptions` ou WP-Cron +5s | "Sincronizacao em background agendada" / JSON |
| Vincular assinaturas ao usuario | AJAX `pawbowl_stripe_backfill_subscription_links` | `backfill_subscription_user_links(limit=500)` | counts scanned/updated/unresolved + reload |
| Vincular este cliente | mesmo AJAX com `subscription_id` + limit 1 | idem | mensagem daquela sub |
| Sincronizar invoices | AJAX `pawbowl_stripe_sync_subscription_invoices` | Stripe API, ate 20 invoices, upsert ledger | "Faturas sincronizadas: N (novas, atualizadas)" + reload |
| Baixar PDF | admin-post GET nonceado | `get_invoice_pdf_url` → redirect para URL Stripe | PDF no browser |
| Exportar CSV frete | admin-post GET nonceado | query ledger shipping items | download CSV |
| Reexecutar migracao frete legado | AJAX (botao so existiria no painel comentado) | `migrate_legacy_invoice_shipping_items_option` | — |

Loading: notices inline "Executando...", botoes disabled. Confirm JS so no replay de webhook (tela nao menuada).

## Regras de negocio

### Fonte da verdade da lista

**[REGRA CONFIRMADA]** SQL em `wp_hsr_stripe_subscriptions` LEFT JOIN `wp_hsr_stripe_customers`. Nao chama Stripe no GET da lista.

### Filtro status

Igualdade `s.status = %s`. Opcoes incluem `canceling`, mas o status persistido e o da Stripe (`active`, `trialing`, `past_due`, ...).

**[REGRA CONFIRMADA]** O card "Cancelando" conta `cancel_at_period_end = 1 AND status IN ('active','trialing','past_due')`. O **filtro** `canceling` **nao replica essa expressao** — tende a zerar a lista.

Classificacao: bug de interface. Na nova stack, filtro "cancelando" deve usar a mesma predicao do KPI.

### Busca

LIKE em: subscription id, customer id, email, nome, `wp_order_id`.

Nao busca invoice id apesar do placeholder "Assinatura, cliente, email, fatura". **[REGRA CONFIRMADA]** placeholder mentiroso.

### Cards / KPI

**[REGRA CONFIRMADA]**

| Card | Query | Respeita filtro da lista? |
|---|---|---|
| Total | COUNT com filtro status se houver | sim (status only, nao search) |
| Ativas | `status IN ('active','trialing')` | nao |
| Cancelando | `cancel_at_period_end=1 AND status IN (active,trialing,past_due)` | nao |
| Em atraso | `status = past_due` | nao |
| Canceladas 30d | `canceled` e `canceled_at >= now-30d` | nao |
| MRR estimado | soma mensalizada de `plan_amount` das active+trialing | nao |
| Renovacao 7d | `current_period_end` entre agora e +7d, status active/trialing/past_due | nao |
| Faturas 30d | COUNT invoices `created_at >= now-30d` | nao |

### MRR **[REGRA CONFIRMADA]** (preservar a formula, nao o Woo)

Para cada assinatura active/trialing com amount>0:

- year → amount/12
- week → amount * 4.34524
- day → amount * 30.4375
- month e interval_count>1 → amount/interval_count
- senao amount

Soma por `plan_currency` (minor units). Moedas zero-decimal (JPY etc.) formatam sem /100.

MRR **nao** desconta cancel_at_period_end. **[INFERENCIA]** inclui quem ja pediu cancelamento no fim do periodo.

### Status badge

- success: active, trialing
- warning: past_due, unpaid
- error: canceled, incomplete_expired
- secondary: resto (paused, incomplete, ...)

### Vinculo usuario

Backfill tenta preencher `wp_user_id` no ledger a partir de email/customer. Nao cria usuario WP.

### PDF invoice

Invoice id deve comecar com `in_`. Nonce por invoice `pawbowl_stripe_invoice_pdf_download:{invoiceId}`. Redirect para URL da Stripe (nao proxy do binario).

### Frete recorrente auditado

Itens injetados em `invoice.created` e persistidos em `wp_hsr_stripe_invoice_shipping_items`. Filtro LIKE em invoice id, correlation id, event id, invoice item id. CSV colunas fixas.

## Validações

- `subscription_id` de sync invoices / backfill unitario: deve comecar com `sub_`
- `per_page` 10–50
- Nonces distintos por acao (sync, run now, invoices, backfill, migrate, pdf, csv)
- Acesso: `is_user_logged_in() && current_user_can('access_pawbowl_stripe')`

## Campos da lista

Assinatura, Cliente (nome, email, cus_ id), Plano (label, price id, amount, interval), Status, Faturamento (renovacao automatica vs cancelamento agendado + order/sub WP), Renovacao (data + "X dias"/"vence hoje"), Ultima fatura, Acoes, Atualizado.

## APIs / Endpoints

Admin AJAX `admin-ajax.php` (nao REST) para as acoes da tela.

REST existentes **nao usadas por esta UI** (sao do app/ops): `/custom/v1/subscriptions`, `/detail`, `/actions`, `/edit/preview`, `/edit/commit`, `/stripe/ops-metrics`.

**[REGRA CONFIRMADA]** Pausar/cancelar/editar plano **nao** esta no painel; esta na REST autenticada do cliente.

Job: hook `hsr_stripe_reconcile_subscriptions` grupo `hsr-stripe-webhooks`.

## Banco de dados

Tabelas (prefixo wp_):

- `hsr_stripe_subscriptions`
- `hsr_stripe_customers`
- `hsr_stripe_invoices`
- `hsr_stripe_orders`
- `hsr_stripe_invoice_shipping_items`
- (schema tambem cria events, payment_intents, charges, refunds, disputes, webhook_inbox, enrichment — pouco/nada nesta UI)

Option de runtime de reconcilicao lida via `get_reconciliation_runtime_status()`.

## Integracoes

- Stripe API: reconcilicao, list invoices, invoice PDF URL, backfill
- Stripe Dashboard links: base `https://dashboard.stripe.com` ou `/test` conforme secret runtime `sk_live_` vs `sk_test_`
- WooCommerce: link `post.php?post={wp_order_id}&action=edit`

## Permissoes

Capability `access_pawbowl_stripe`. Nonces AJAX `check_ajax_referer`.

Painel de status de reconcilicao HTML esta **comentado** no PHP; so a nota "Última sincronização" permanece visivel.

## Dependencias

- Action Scheduler (preferencial) ou WP-Cron
- Stripe env keys para acoes live
- WooCommerce opcional para abrir pedido

## Tratamento de erros

JSON `{success:false, data.message}` → notice vermelha.  
PDF/CSV nonce invalido → wp_die.  
Servico indisponivel → 500 com mensagem.

## Estados da assinatura (ledger)

active, trialing, past_due, unpaid, canceled, incomplete, incomplete_expired, paused + flag `cancel_at_period_end`.

Nao ha "ativar/desativar" local: o status e replica da Stripe via webhook/reconcilicao.

## Observacoes para migracao

- Painel de assinantes = **read model do ledger** + jobs de sync + deep links Stripe.
- Nao consultar Stripe para cada linha da grid.
- Expor acoes de ciclo de vida (pause/cancel/change plan) so se o produto quiser no admin; hoje isso e do app do cliente.
- Corrigir filtro Cancelando e busca por fatura.
- Default "so ativas" e comportamento de produto: preservar ou tornar explicito na UX.
