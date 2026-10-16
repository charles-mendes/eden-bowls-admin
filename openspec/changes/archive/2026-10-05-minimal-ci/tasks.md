# Tasks

## 1. Workflow skeleton

- [x] 1.1 Add `.github/workflows/ci.yml` with `pull_request`, `push` to `main`, and `workflow_dispatch`, `permissions: contents: read`, `timeout-minutes: 20` on every job, and a concurrency group that cancels in-progress runs only when `github.event_name == 'pull_request'`. Verify the file is valid YAML, those three triggers are present, `main` pushes are not cancelled, and `.github/workflows/copilot-setup-steps.yml` is unchanged.

## 2. Required checks

- [x] 2.1 Add job `lint` that uses Node 20, runs `npm ci`, then `npm run lint`, and has no `needs`. Verify the job name is `lint`.
- [x] 2.2 Add job `unit` that uses Node 20, runs `npm ci`, then `npm test`, and has no `needs`. Verify the test command is `npm test`.
- [x] 2.3 Add job `build` that uses Node 20, runs `npm ci`, then `npm run build`, with placeholder `VITE_ADMIN_API_BASE_URL` and `VITE_APP_BASE_PATH` and no `secrets` context. Verify a search of the workflow finds no `secrets.` and that `build` has no `needs`.
- [x] 2.4 Add job `e2e` that uses Node 20, runs `npm ci`, installs Chromium with OS dependencies, then runs `npm run test:e2e` without `--workers` or `--ui`. Verify `e2e` has no `needs` and does not override trace, screenshot, or video.
- [x] 2.5 On `e2e` failure only, upload `playwright-report/` and `test-results/` with 7-day retention. Verify the upload step is conditioned on failure and is absent from `lint`, `unit`, and `build`.

## 3. Change check

- [x] 3.1 Run `openspec validate minimal-ci --type change` and verify it exits 0. The first execution of the four checks happens when the workflow file is opened as a pull request; do not treat a local full suite as a substitute for that run.
