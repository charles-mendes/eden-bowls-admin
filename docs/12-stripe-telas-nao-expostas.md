# Stripe — telas implementadas no codigo e nao expostas no menu

## Contexto

`StripeAdminModule` ainda contem paginas completas de Dashboard, Configuracoes, Webhooks, Logs, Eventos e Diagnostico. `register_admin_menu()` **no estado atual so registra Assinantes** (mais o alias oculto `pawbowl-stripe-dashboard`, que aponta para a lista de assinantes — nao para `render_dashboard_page`).

Cupons e um submenu separado em `StripeCouponsPage`.

**[REGRA CONFIRMADA]** `render_dashboard_page`, `render_settings_page`, `render_webhooks_page`, `render_logs_page`, `render_events_page`, `render_diagnostics_page` existem mas **nao tem `add_submenu_page`**. Links internos dessas paginas (ex.: "Ver eventos", "Abrir configuracoes") apontam para slugs `pawbowl-stripe-events` / `pawbowl-stripe-settings` que **nao estao no menu**. Acessar a URL direta provavelmente cai no "Sorry, you are not allowed to access this page" do WP.

Classificacao: divida de produto / debito. Documentado para nao perder regras que o codigo ja implementou caso a nova stack queira um modulo de observabilidade.

Abaixo: comportamento **se as paginas fossem montadas**, extraido do codigo. Nao afirmar que o operador usa isso hoje.

---

## Dashboard operacional (nao menuado)

Objetivo: metricas de webhook (recebidos, processados, rejeitados, duplicados, replays, bloqueios 24h, tempo medio, eventos/falhas hoje), alinhamento Admin vs Runtime de credenciais, alertas de `get_technical_metrics(15)`, top eventos 7d, falhas recentes, export JSON / endpoint `GET /custom/v1/stripe/ops-metrics` (`manage_woocommerce`/`manage_options`).

Options lidas: `hsr_stripe_webhook_observability`, `hsr_stripe_webhook_retry_state`, `hsr_stripe_webhook_dead_letter`, `hsr_stripe_webhook_event_state`, `hsr_stripe_webhook_history`, `hsr_stripe_replay_guardrail_stats`.

---

## Configuracoes Stripe (nao menuado)

Campos: publishable key (texto), secret key e webhook secret (password, mascarados, blank = manter), mode test|production, timeout 3–120s default 20, max retries 0–10 default 2.

**[REGRA CONFIRMADA]** Segredos gravados em option `pawbowl_stripe_admin_settings` com AES-256-CBC usando `AUTH_KEY`/`wp_salt('auth')`.

**[REGRA CONFIRMADA]** O proprio texto da UI diz que **estas configs NAO substituem as env vars de runtime**. Checkout/webhook usam `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET`. A tela compara hash das duas fontes e alerta mismatch.

Acao Testar conexao: `accounts.retrieve()` com a secret efetiva (input ou gravada).

Na nova stack: **nao persistir secret no banco do admin** se o runtime ja usa secret manager/env. Se houver UI de chaves, deixar claro que e so diagnostico.

---

## Webhooks toggles (nao menuado)

Option `pawbowl_stripe_webhook_admin_settings.enabled_events`. Default: todos os eventos da lista `supported_webhook_events()` **ligados** se a chave nao existe.

Desligar um evento faz o backend **ignorar internamente** aquele tipo, sem mudar o endpoint no painel Stripe.

Eventos suportados (lista fechada no codigo): subscription created/paused/resumed/trial_will_end/deleted/updated; invoice created/finalized/paid/payment_failed/payment_action_required; customer created/updated/deleted; charge.refunded; refund created/updated; payment_intent succeeded/failed; charge.dispute created/updated/closed.

URL exibida: `POST /wp-json/custom/v1/stripe-webhook`.

---

## Logs / Eventos (nao menuado)

Mesma fonte: option `hsr_stripe_webhook_history`, max 200 apos filtro, sort desc.

Filtros GET: status (`processed|failed|rejected|duplicate`), event_type, replay yes/no, search (id, tipo, erro, correlation, request id).

Detalhe: payload, headers, response, error, stack. Botao **Reprocessar webhook** (nonce `pawbowl_stripe_replay_submit`) chama `replay_webhook_history_entry` com `user_id` e `correlation_id=admin_replay_{user}_{time}`. Confirm JS.

Guardrails de replay **[REGRA CONFIRMADA]** (preservar se houver replay no admin novo):

- `replay_window_expired`
- `replay_attempt_limit_reached`
- `replay_rate_limited` (por usuario)
- `replay_requires_user`
- `history_payload_too_large`
- `history_event_mismatch`
- payload vazio/invalido, event invalido, history id invalido, timestamp invalido

Identificacao de replay: `response.replay`, header `x-replay=true`, ou correlation_id prefixo `admin_replay_` / `replay_`.

Logs vs Eventos: textos de pagina diferentes, mesma tabela/handlers.

---

## Diagnostico (nao menuado)

Checks: env secret (`sk_`), env webhook (`whsec_`), SDK presente, Action Scheduler + jobs `hsr_stripe_webhook_retry_event`, WP-Cron `DISABLE_WP_CRON`, contadores de observabilidade, conectividade `accounts.retrieve()` so apos POST nonceado "Executar diagnostico completo".

Nao altera checkout.

---

## Observacoes para migracao

Se a nova stack precisar de observabilidade Stripe:

- Historico de eventos em tabela (o option WP nao escala).
- Replay com os guardrails acima.
- Toggles por tipo de evento como kill-switch operacional.
- Nunca tratar a UI de chaves como runtime.
- Endpoint ops-metrics ja existe e pode ser reaproveitado por monitoramento externo (`manage_options` hoje).

Se nao houver dono para essas telas, tratar como **nao-requisito do MVP do painel**, mas manter o processamento de webhook (isso e backend, nao tela).
