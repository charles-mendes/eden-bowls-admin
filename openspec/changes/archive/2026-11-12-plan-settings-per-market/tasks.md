# Tasks

## 1. Plano screen

- [x] 1.1 Add `src/pages/PlanSettingsPage.tsx` at `/catalog/plan` (`src/App.tsx`) and the **Plano** menu item in Loja (`src/lib/menu.ts`): market filter, GET/PUT plan-settings, read-only without `catalog.write`, field validation, 422 messages, unsaved warning; verify with `PlanSettingsPage.test.tsx`, `menu.test.ts` and a Playwright screenshot.
- [x] 1.2 Add the plan-settings routes to `src/test/mockAdminFetch.ts` and fixtures; run `npm run contract:sync` after the backend manifest is updated and commit `contracts/backend-routes.json`; verify the Vitest contract check passes.

## 2. Product page without plan values

- [x] 2.1 Remove plan days and large-pack limit (state, fields, "Plano" section, payloads of save and publish) from `ProductDetailPage.tsx` and plan days from create in `ProductsPage.tsx`; the unsaved warning covers only the country; verify with `ProductDetailPage.test.tsx` and `ProductsPage.test.tsx` updated to the new scenarios.

## 3. Integration check

- [x] 3.1 With the backend change applied locally, save BR plan settings on **Plano**, publish a draft product and confirm the PATCH has no `planDays`; Playwright screenshot of both screens.
