# Proposal

## Why

Pull requests to `eden-bowls-admin` can merge with no automated check. The only GitHub Actions workflow here is `copilot-setup-steps`. The panel already has ESLint, Vitest, a TypeScript production build, and Playwright specs that mock `/api/v1`, but none of those run before merge.

## What Changes

- Add one GitHub Actions workflow on pull requests, pushes to `main`, and manual dispatch.
- Required jobs: ESLint (`npm run lint`), Vitest (`npm test`), production build (`npm run build`, which already runs `tsc -b`), and Playwright (`npm run test:e2e`) with the existing config (4 workers, Chromium, Vite on port 4174, API mocked).
- Upload Playwright's failure-only HTML report and trace. Do not enable video or always-on screenshots.
- Build with placeholder `VITE_ADMIN_API_BASE_URL` and `VITE_APP_BASE_PATH`. Do not read backend secrets and do not print the environment.
- Leave `copilot-setup-steps.yml` in place.
- Matching `minimal-ci` changes in `eden-bowls` and `eden-bowls-backend` cover those repositories. This change does not edit them.

## Capabilities

### New Capabilities

- `delivery/continuous-integration`: An admin pull request is validated by lint, unit tests, a production build, and mocked Playwright before it can be treated as ready.

### Modified Capabilities

- None. Existing `operations/*` specs describe panel behavior, not CI.

## Impact

- New workflow file under `.github/workflows/` in `eden-bowls-admin` only.
- Node 20, matching `Dockerfile`. No new test runner and no MySQL. The panel has no integration suite.
- Playwright does not need the backend; specs use `e2e/helpers/mockAdminApi.ts`.
- Required check names are the approval gate. Branch protection stays a repository setting.
