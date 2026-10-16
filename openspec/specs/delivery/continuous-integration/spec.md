# delivery/continuous-integration Specification

## Purpose
Validates an admin-panel change with the existing lint, unit tests, production build, and mocked browser flows before that change is treated as ready to merge.

## Requirements

### Requirement: Admin changes are validated automatically
The repository MUST run continuous integration on every pull request, on every push to `main`, and when a person starts the workflow manually. The workflow MUST NOT replace the existing Copilot setup workflow.

#### Scenario: Pull request opened
- **WHEN** a pull request is opened or updated against this repository
- **THEN** the admin validation workflow starts without a manual step

#### Scenario: Push to main
- **WHEN** a commit is pushed to `main`
- **THEN** the same required checks run

#### Scenario: Manual run
- **WHEN** a person dispatches the workflow
- **THEN** the same required checks run

### Requirement: Lint, unit tests, production build, and browser flows are required checks
The workflow MUST run four required checks: the existing ESLint script, the existing Vitest suite, the existing production build (including its TypeScript check), and the existing Playwright suite. Lint, Vitest, and the production build MUST NOT wait on each other. Playwright MUST keep 4 workers, Chromium only, failure-only trace and screenshot, and video off. Playwright MUST start the existing Vite dev server and MUST NOT call a live API.

#### Scenario: All checks pass
- **WHEN** lint, Vitest, the production build, and Playwright all succeed
- **THEN** the workflow result is success

#### Scenario: One check fails
- **WHEN** any one of those four checks fails
- **THEN** the workflow result is failure and the other checks are still reported rather than omitted

#### Scenario: Playwright stays mocked
- **WHEN** Playwright runs in CI
- **THEN** it uses the repository's API mocks and does not require a backend token or database

### Requirement: CI uses placeholders and does not expose secrets
The production build in CI MUST receive only placeholder public configuration. The workflow MUST NOT read backend or Stripe secrets, and MUST NOT print the process environment.

#### Scenario: Build without live keys
- **WHEN** the production build runs in CI
- **THEN** it completes with placeholder `VITE_*` values and no secret material appears in the log

### Requirement: Browser failure evidence is kept
When Playwright fails, the workflow MUST upload the HTML report and the failure trace as a build artifact and MUST NOT upload a video. When Playwright passes, the workflow MUST NOT upload those artifacts.

#### Scenario: Playwright failure
- **WHEN** the Playwright check fails
- **THEN** the HTML report and failure trace are downloadable from that workflow run

#### Scenario: Playwright success
- **WHEN** the Playwright check passes
- **THEN** no Playwright report or trace artifact is uploaded
