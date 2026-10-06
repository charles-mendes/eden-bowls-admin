# Design

## Context

See proposal.md for why. `origin` is GitHub, the default branch is `main`, and the only workflow is `copilot-setup-steps.yml`. Scripts that already exist: `npm run lint` (ESLint), `npm test` (Vitest), `npm run build` (`tsc -b` then Vite), and `npm run test:e2e` (Playwright, 4 workers, `CI` retries, Vite dev server on `127.0.0.1:4174`). Specs mock `/api/v1` through `e2e/helpers/mockAdminApi.ts`. `Dockerfile` uses Node 20. There is no MySQL and no integration script.

## Goals / Non-Goals

**Goals:**

- One Actions workflow with four required checks and no false ordering between lint, unit, and build.
- Playwright isolated, mocked, and artifact-only on failure.
- Placeholder `VITE_*` values, no secrets.

**Non-Goals:**

- A MySQL service, a backend boot, or a Docker image build.
- Changing ESLint, Playwright, or Vitest config.
- Editing `copilot-setup-steps.yml` or the other repositories.
- Enabling branch protection from the workflow file.

## Decisions

### Platform and triggers

GitHub Actions. The remote is GitHub and `.github/workflows/` already exists.

```
pull_request
push branches: [main]
workflow_dispatch
```

`permissions: contents: read`. Node 20. `npm ci`. No `pull_request_target`. One concurrency group per ref. `cancel-in-progress` is true only for `pull_request`, so a later push to `main` does not cancel the run of the previous commit. Each job sets `timeout-minutes: 20`. Action references stay on major tags (`actions/checkout@v4`, `actions/setup-node@v4`). Pinning SHAs is out of scope.

### Jobs

```
pull_request | push main | workflow_dispatch
        |
        +-- lint      npm run lint
        +-- unit      npm test
        +-- build     npm run build
        +-- e2e       playwright install chromium + npm run test:e2e
```

No `needs`. Lint, unit, and build do not depend on each other. `e2e` does not wait for `build` because `webServer` runs `npm run dev`, not the production bundle. Do not pass `--workers` or `--ui`. Actions sets `CI=true`, which already selects Playwright `retries: 2`.

### Playwright artifacts

Upload `playwright-report/` and `test-results/` with `if: failure()` and 7-day retention. Do not override `trace: retain-on-failure`, `screenshot: only-on-failure`, or `video: off`.

### Secrets

Build `env` sets `VITE_ADMIN_API_BASE_URL` to a placeholder such as `http://127.0.0.1:3000/api/v1` and `VITE_APP_BASE_PATH=/`. No `secrets.*`. No step prints the environment. The dev server for Playwright does not need a token; mocks answer `/api/v1`.

### Approval and failure

The pull request is approvable by CI only when `lint`, `unit`, `build`, and `e2e` are green. No `continue-on-error`. The only retry is Playwright's existing CI retry. No chat notification.

## Risks / Trade-offs

- [Four jobs repeat `npm ci`] → Acceptable at this size. A shared install artifact would be a fourth moving part.
- [ESLint and `tsc` overlap on type-ish issues] → Keep both. Lint is the one script the storefront does not have; dropping it here would ignore a tool that already exists.
- [Playwright install is the slow job] → Parallel with the others, not behind build.

## Migration Plan

Add the workflow on a pull request. After a green run on `main`, require the four check names in branch protection. Rollback is deleting the workflow file.

## Open Questions

None that change the jobs or the spec.
