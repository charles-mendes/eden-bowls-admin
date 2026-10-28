# operations/admin-settings Specification

## Purpose
Lets the team change company data, legal documents and the automated life-stage emails from the panel instead of code and environment variables.

## Requirements

### Requirement: Settings page

The panel MUST have a "Configurações" item in the Administração group at `/config`, shown to admin, operator and readonly. The page MUST have three tabs, "Empresa", "Documentos legais" and "E-mails automáticos", with a market choice when the user has both markets.

#### Scenario: Veterinarian has no settings

- **WHEN** a veterinarian opens the menu
- **THEN** "Configurações" is not listed

### Requirement: Company profile tab

The "Empresa" tab MUST show legal name, tax id (CNPJ in BR, EIN in US), street, complement, city, state, postal code, country, support email and store URL of the market. Only a user with `settings.company.write` MUST be able to save, with `PUT /api/v1/admin/settings/company` and the fields under `profile`. The tab MUST say that new invoices and emails use the data, and that invoices already issued keep the issuer they printed. A 422 `company_profile_invalid` MUST mark the listed fields.

#### Scenario: Operator reads but cannot save

- **WHEN** an operator opens the BR profile
- **THEN** the fields are read-only and there is no "Salvar empresa" button

#### Scenario: Invalid CNPJ

- **WHEN** an admin saves and the API answers 422 with `tax_id`
- **THEN** the CNPJ field is marked invalid

### Requirement: Legal documents tab

The "Documentos legais" tab MUST show, per market and kind (privacy policy, terms of use), the current version, its publication date, its text and the list of earlier versions, each readable. Only a user with `legal.write` MUST be able to publish a new version with an id `AAAA-MM-DD` and a Markdown body, after confirmation. A 409 `legal_version_taken` MUST say the version id is already used.

#### Scenario: Publish new terms

- **WHEN** an admin publishes US terms version 2026-11-01
- **THEN** the page sends `POST /api/v1/admin/legal/terms` with the market, version and body and shows 2026-11-01 as current

#### Scenario: Version id already used

- **WHEN** the API answers 409 `legal_version_taken`
- **THEN** the page says that version already exists and keeps the typed text

### Requirement: Automated emails tab

The "E-mails automáticos" tab MUST show for the market whether the stage-change email is on, the announcement batch and the daily cap. A user with `settings.email.write` MUST be able to save with `PUT /api/v1/admin/settings/automated-emails`. The page MUST refuse locally a daily cap lower than the batch, and say that a change applies at the next run of the job.

#### Scenario: Cap lower than batch

- **WHEN** an operator types batch 100 and daily cap 50
- **THEN** the cap field is marked invalid and no request is sent
