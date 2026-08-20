---
name: frontend-design
description: Build and style internal admin-panel / back-office interfaces (dashboards, CRUD screens, data tables, forms, settings pages) with a consistent, professional design system. Use this skill any time the user asks to build, edit, or restyle a screen, component, or page inside the admin panel — examples include dashboards, list/table views, detail views, forms, filters, modals, sidebars, or any internal tool UI. Also use whenever the user mentions "painel administrativo", "admin panel", "back office", "dashboard interno", or references this project's UI conventions. Produces clean, data-dense, functional interfaces — NOT bold/experimental marketing-site design.
license: Complete terms in LICENSE.txt
---

This skill guides creation of a consistent **admin-panel design system** for internal tools. Unlike marketing pages or landing pages, admin panels exist to help staff work quickly and accurately with data. Prioritize clarity, density, and consistency over novelty. Every screen should look like it came from the same product.

The user provides a screen, component, or feature to build (a list view, a form, a dashboard widget, a settings page, etc.). Treat every request as part of the same design system — reuse the same tokens, components, and patterns already established elsewhere in the panel rather than inventing new ones per screen.

## Design Thinking

Before coding, ground the work in the admin-panel context:
- **Purpose**: What task does this screen let staff accomplish (view records, edit an entity, monitor a metric, configure a setting)? Optimize for that task, not for visual impact.
- **Audience**: Internal staff who use this repeatedly, not first-time visitors. Favor familiar, predictable patterns over "wow" moments — repeated users reward speed and consistency, not surprise.
- **Density vs. clarity**: Admin panels legitimately show more information per screen than consumer apps. Use a clear visual hierarchy (typographic scale, spacing, grouping) so density doesn't become clutter.
- **Consistency**: Match existing sidebar, header, spacing scale, colors, and component styles already used elsewhere in the panel. Do not introduce a new font, palette, or layout style for a single screen.

**CRITICAL**: The aesthetic direction for this project is **clean / functional / professional** — think Linear, Stripe Dashboard, Notion, Vercel — not maximalist, brutalist, or experimental. Distinctiveness comes from a well-executed, cohesive design system, not from bold visual statements per screen.

Then implement working code (React/HTML/CSS, per the project's stack) that is:
- Production-grade and functional
- Consistent with the rest of the admin panel
- Data-dense but scannable
- Accessible (keyboard navigation, focus states, sufficient contrast, readable table/form semantics)

## Design System Guidelines

### Typography
- Use one clean, highly legible sans-serif for UI text (e.g. a grotesk/neutral system font family), consistently across the whole panel. Admin panels favor legibility over character — do not swap fonts per screen.
- Establish a small, disciplined type scale (e.g. 12/14/16/20/24px) for labels, body, headings, and page titles. Reuse it everywhere.
- Use weight and size — not color or decoration — to establish hierarchy (page title > section header > field label > body text > helper/meta text).

### Color & Theme
- Base palette: neutral grays for backgrounds, borders, and surfaces (with a light and dark mode if the project supports both). Reserve saturated color for meaning, not decoration.
- One brand/accent color for primary actions and active/selected states.
- Fixed **semantic colors** used consistently everywhere: success (green), warning (amber), danger/error (red), info (blue). Use these for badges, alerts, form validation, and status indicators — never repurpose them decoratively.
- Avoid gradients, glows, and decorative color washes. Flat, high-contrast surfaces read faster.

### Motion
- Keep motion subtle and functional: fast fades/transitions (~100–200ms) for opening menus, modals, drawers, and toasts; skeleton loaders instead of spinners where possible for tables/cards.
- No decorative animation, scroll-triggered reveals, or playful micro-interactions — they slow down repeat users and feel out of place in a work tool.

### Spatial Composition
- Standard admin shell: fixed/collapsible sidebar for navigation + top bar (breadcrumbs, search, user menu) + main content area. Keep this shell identical across all screens.
- Use a strict spacing scale (e.g. 4/8/12/16/24/32px) for padding, gaps, and margins. Align to a grid — no ad hoc spacing.
- Group related fields/controls into clearly bordered or shadowed cards/sections. Left-align content; avoid centered or diagonal/asymmetric layouts — predictability matters more than visual flair here.

### Backgrounds & Visual Details
- Prefer flat, neutral surfaces with subtle borders or very light shadows to separate cards/panels from the page background. Avoid noise textures, gradient meshes, or illustrative backgrounds — they compete with the data.
- Use icons from a single consistent icon set (outline or filled, not mixed) for nav items, actions, and status indicators.

## Core Admin-Panel Patterns

Reuse these patterns rather than reinventing them per screen:

- **Navigation**: persistent sidebar with grouped nav items and an active-state highlight; breadcrumbs in the top bar for nested pages.
- **Data tables**: sortable columns, row hover state, sticky header on scroll, pagination or infinite scroll, bulk-select with a contextual action bar, column-level filters, empty state and loading (skeleton) state.
- **Forms**: labeled fields with inline validation messages, clear required/optional indicators, grouped sections for long forms, sticky save/cancel actions.
- **Filters & search**: a consistent filter bar/drawer pattern (chips for active filters, a clear "reset" action) rather than one-off filter UIs per page.
- **Status & metadata**: small pill/badge components using the semantic colors above (e.g. Active/Inactive, Pending/Paid/Failed).
- **Dashboard widgets**: stat cards (label, value, delta/trend) and charts using the same neutral palette + accent/semantic colors — no decorative chart styling.
- **Modals & drawers**: for create/edit flows that don't need a full page; consistent header/body/footer structure with primary+secondary actions.
- **Feedback states**: consistent empty states, error states, and toast/notification style used everywhere, not designed fresh per screen.

## What to avoid

- Generic AI-aesthetic clichés: purple gradients on white, default Bootstrap/AdminLTE look-alikes, unstyled default form controls.
- Anything from the general "bold/maximalist" creative-design playbook (this project intentionally does **not** want that): oversized display type, asymmetric/diagonal layouts, heavy decorative textures, playful scroll animations. Those are appropriate for marketing sites, not this admin panel.
- Introducing a new font, color, spacing scale, or component style that isn't already part of the system — always check existing screens/components first and match them.
- Sacrificing information density or scanability for visual novelty.

Elegance here comes from restraint and consistency: the same shell, the same tokens, the same components, applied precisely on every screen.
