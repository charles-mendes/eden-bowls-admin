---
name: run-tests
description: Run the smallest related Vitest or Playwright subset after an admin frontend change. Use when validating code, choosing test commands, or tempted to run npm test / the full E2E suite.
---

# Run related tests only

Never run the full suite by default. After changing a file, find related tests, run only those, fix failures, then widen scope if needed.

For frontend changes:
1. Run the related Vitest tests first.
2. Do not run the entire test suite unless necessary.
3. Use --related or --changed whenever possible.

Do not use `npm test`, `npm run test:all`, `npx playwright test` without a file, or `npx playwright test --ui`.

If Vitest or Playwright are not in `package.json` yet, do not install them just to satisfy this skill.

## Vitest

```bash
npx vitest run --related src/pages/UsersPage.tsx
npx vitest run -t "should load admin session"
npx vitest run --changed
```

`--related` is much better than `npm test` for a small change. Keep the 4-thread pool from `vite.config.ts`; do not serialize.

## Playwright

```bash
npx playwright test e2e/specs/admin-login.spec.ts --workers=4
npx playwright test e2e/specs/admin-users.spec.ts -g "loads customer detail" --workers=4
npx playwright test e2e/specs/admin-readonly.spec.ts --workers=4
```

Match the spec to the flow: login, users (list/detail/mutation), orders, onboarding, catalog, billing, readonly. Do not treat login as the only E2E coverage.

`--ui`, `--headed` and `--debug` are for a human investigating locally, not for the agent. Reporter is `line`: one test, one error, relevant stack.

Do not generate huge artifacts on a normal run. Never set or pass `trace: 'on'`, `video: 'on'`, `screenshot: 'on'`, `--trace on`, `--video on`, or `--screenshot on`. Config must stay:

```ts
trace: 'retain-on-failure',
screenshot: 'only-on-failure',
video: 'off',
```

PASS → done. FAIL → trace and screenshot are kept for investigation. Do not dump them into the agent log.

Full `npm run test:e2e` only for structural / high-impact changes.
