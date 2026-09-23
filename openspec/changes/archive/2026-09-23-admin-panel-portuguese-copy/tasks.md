# Tasks

## 1. Assinantes

- [x] 1.1 Add Portuguese labels for `canceling` and `all` on `formatStripeStatus`, and add a sync-job label helper in `src/lib/format.ts` with the same four dashboard strings (`idle`, `queued`, `completed`, `completed_with_skips`). Leave the dashboard-local map in place. Verify the helper returns `na fila` for `queued` and `concluído` for `completed`.
- [x] 1.2 Translate Assinantes in `src/pages/BillingPage.tsx` and the menu group to **Cobrança** in `src/lib/menu.ts`: page and catalog copy, button **Sincronizar catálogo**, mapped line, Portuguese filter labels with English option values, columns Assinatura / Renovação automática / Próxima cobrança, and Portuguese fixed fallbacks. Verify `src/pages/BillingPage.test.tsx` and `src/test/integration/readonly-shell.test.tsx` after updating the old button name.
- [x] 1.3 Translate subscription detail actions in `src/pages/SubscriptionDetailPage.tsx`: Portuguese ledger description, **Sincronizar faturas**, section **Envio UPS**, columns Fatura / Rastreio / Cotado / Custo UPS, buttons Baixar / Atualizar rastreio / Anular, and Portuguese fixed fallbacks. Do not change the empty-address sentence in this task. Verify `src/pages/SubscriptionDetailPage.test.tsx` still finds **Detalhes do produto** and the updated action names.
- [x] 1.4 Update `e2e/specs/admin-billing.spec.ts` and `e2e/specs/admin-readonly.spec.ts` for **Sincronizar catálogo** and the Portuguese sync message. Leave the “Slots sincronizados” assertion for task 3.4. Verify those two specs. Check the Assinantes table and the Envio UPS table for wrapped headers.

## 2. Operação e cliente

- [x] 2.1 Translate onboarding and snapshot copy in `OnboardingPage.tsx`, `OnboardingSessionPage.tsx`, `LedgerSnapshotSections.tsx`, and `CheckoutSnapshotPanels.tsx`. Empty address becomes **Sem endereço na cópia gravada**. The recurrence disclosure title becomes **JSON de recorrência**, not **Recorrência**. Verify `SubscriptionDetailPage.test.tsx` and `OnboardingSessionPage.test.tsx` for the new address sentence and that **Recorrência** is not a disclosure title.
- [x] 2.2 Translate only the delivery-instructions title and description in `UserDetailPage.tsx`. Leave DSAR, opt-in, and opt-out. Verify `UserDetailPage.test.tsx` still expects `Marketing: opt-out`.
- [x] 2.3 Replace “KPIs” in the production filter description with “indicadores”, and replace “default do motor” in the shared nutrition description with “padrão do motor”. Do not edit the US label map. Verify `admin-login` still expects the heading **Nutrition simulator** if that spec is run; otherwise verify the US title string is unchanged in `NutritionSimulatePage.tsx`.
- [x] 2.4 Point `DashboardPage.tsx` at the sync-job helper, remove the local map, and change “Sync e assinantes” and “Último sync” to Portuguese. Title stays **Dashboard**. Verify `src/pages/DashboardPage.test.tsx`, including an assertion of the visible job label when the page renders it.

## 3. Catálogo, frete e cupons

- [x] 3.1 Translate shipping labels only in `ShippingPage.tsx` (US tab **Estados Unidos**, US form labels, BR **Fator de correção** and **Km máximos**). Do not change settings keys or the save body. Verify `src/pages/ShippingPage.test.tsx`.
- [x] 3.2 Translate product publish copy in `ProductDetailPage.tsx` (“Publicação bloqueada: faltam preços na Stripe.”, “Publicação e sincronização”, columns Produto Stripe / Preço Stripe, fallbacks “Falha ao publicar” and “Falha ao sincronizar”). Keep the button **Sincronizar Stripe**. Verify `src/pages/ProductDetailPage.test.tsx`.
- [x] 3.3 Translate business-rule labels in `BusinessRulesPage.tsx` (Domínio, Chave, Mercado, Ativa, Vigente desde, Valor (JSON), Vigente até). Do not rename the JSON keys that are submitted. Verify the page test if one exists; otherwise verify the visible labels in the file.
- [x] 3.4 Translate coupon labels and the sync success message in `CouponsPage.tsx`. Do not edit the `formatTermMonths` cell, the `6m` alerts, or the `First purchase` placeholder. Verify `src/pages/CouponsPage.test.tsx` still expects **1 mês** in the Slot cell, and update `e2e/specs/admin-billing.spec.ts` for the Portuguese sync success message.

## 4. Loja e backend

- [x] 4.1 Do not edit `eden-bowls` or `eden-bowls-backend`. Verify this change’s diff stays inside `eden-bowls-admin`. No API body, query param, or store screen changes.
