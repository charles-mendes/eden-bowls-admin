# Design

## Context

See proposal.md for motivation. **Hoje** (`/dashboard`) already covers the operational day via `GET /admin/today`. Assinantes and the checkout list already exist (`/billing`, `/onboarding/sessions`). There is no insights API. The canvas is the visual contract for layout and copy. The panel font stays IBM Plex Sans (`src/index.css`). Inter appears only in the saved canvas. `--accent` is `#2563eb`, the same blue as the info status color, so a status dot on this page must not reuse it.

`package.json` has no chart library. The admin design skill is still named `frontend-design`, the same name as the store skill. `RequireAuth` already sends a veterinarian-only session to `/nutrition/simulate` for every path other than the simulator and the password screen.

## Goals / Non-Goals

**Goals:**

- Port the prototype into a React page that reuses `PageFrame`, `segmented` and the existing shell, and only on a demo build.
- Keep fictional numbers out of production.
- Encode the chart rules in the admin skill under a unique name.

**Non-Goals:**

- No `GET /admin/insights` and no `routes:manifest` / `contract:sync`.
- No Recharts, visx or any chart package.
- No Tweaks panel (accent picker stays canvas-only).
- No change to Hoje, Saúde do sistema or the checkout cards removed from the dashboard.
- No switch of the panel font to Inter.

## Decisions

### 1. Demo flag, then the fixture

`src/lib/demoInsights.ts` exports `demoInsightsEnabled()`, true only when `import.meta.env.VITE_DEMO_INSIGHTS === 'true'`. Declare the variable in `src/vite-env.d.ts`. Menu and route both read that helper.

With the flag off, `/insights` is `<Navigate to="/dashboard" />` and the menu item is not registered. With the flag on, the route renders the page. The fixture stays in `src/lib/businessOverview.ts` (Brasil / EUA, factors `0.25` / `1` / `2.9`). The page does not call `apiRequest` for these metrics.

Alternative considered: ship the page in production behind the badge. Rejected — operators would see an invented MRR next to live screens.

Alternative considered: a fake `/admin/insights` mock. Rejected — tests and the route contract would expect an API route that does not exist.

### 2. CSS charts, tooltip only on the trend

Grouped vertical bars, funnel bars and horizontal mix bars are CSS and `div`. The trend figure has `role="img"`, an `aria-label` with the totals, and a `title` on each week group. Funnel and mix already print the number beside the bar, so they do not get a tooltip. `font-variant-numeric: tabular-nums` on every metric.

The **Renovam em 7 dias** dot is gray (`#71717A`), not `#2563eb`, because that blue is both `--accent` and the info status color.

Recharts 3 stays a later option, and only after an explicit install approval.

### 3. No Todos; one market omits the control

MRR and ticket are in `R$` or `US$`. Dual-market sessions get Brasil / EUA, default Brasil. A single-market session omits the control. The subtitle names the market and the period, for example “de Brasil nos últimos 30 dias”, with no clock time.

### 4. What the period changes

Scale faturamento no período, canceladas, churn (from scaled canceladas and fixed ativas) and the three funnel counts. Leave MRR, ticket, deltas, ativas, cancelando, em atraso, renovam em 7 dias, the Hoje strip, the eight-week series, the mix and the simplified-checkout share alone. Conversion rates do not move, because every funnel stage uses the same factor. The trend caption stays “últimas 8 semanas” on 7, 30 and 90 dias.

### 5. Phase 2 query is a demo-only exception

Canvas Tweaks do not ship. `?fase2=1` is the accepted exception to the “no hidden knobs” rule, and only while `demoInsightsEnabled()` is true. Production never mounts the page, so the query cannot skip a real check. On the demo build the badges stay off until the query is present, including for operator, so the client walkthrough does not depend on an admin session. They mark Receita, tendência and mix.

### 6. Links reuse screens that already exist

- Hoje strip → `/dashboard`
- Ver assinantes → `/billing`
- Ver checkouts → `/onboarding/sessions`

Strip counts stay fictional so the demo does not mix live `/admin/today` with fake MRR.

### 7. Rename the admin skill, keep IBM Plex Sans

Move `.agents/skills/frontend-design/` to `.agents/skills/admin-panel-design/`. Change `name` so an agent does not load the store skill. Add a short **Charts** section: primary series = accent; comparison = gray; status colors never as a series; bars, no pie, no 3D; `tabular-nums` + pt-BR; `aria-label` summary; tooltip only when the value is not already printed beside the mark.

Search the admin repo for `frontend-design` and update live citations (`AGENTS.md`, `.github/copilot-instructions.md`, and any hit under `CLAUDE.md`, `openspec/project.md` or `.claude/`). Leave `openspec/changes/archive/` as history.

## Risks / Trade-offs

- [Demo build left on in production] → Mitigation: the flag defaults off; unset means redirect to `/dashboard` and no menu item. The badge remains on the demo build.
- [Fase 2 lida como API pronta] → Mitigation: badges off unless `?fase2=1`, and that query does nothing without the flag.
- [`?fase2=1` é um knob] → Accepted only on the demo build. It labels sections; it does not skip validation.
- [Skill rename quebra prompts antigos] → The new description still matches “painel administrativo”; archives may keep the old path.

## Migration Plan

Ship the page and the skill rename together. Production does not set `VITE_DEMO_INSIGHTS`. The demo environment sets it to `true`. Rollback is unsetting the flag; no schema or API change.

## Open Questions

None.
