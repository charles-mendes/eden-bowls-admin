# Design

## Context

A API da fase 3 expõe, por mercado:
- `GET /admin/life-stage`, `PUT /admin/life-stage/limits`, `POST /admin/life-stage/breeds`, `PATCH /admin/life-stage/breeds/:id` e `POST /admin/life-stage/preview`;
- `GET /admin/nutrition/parameters`, `PUT|DELETE /admin/nutrition/parameters/draft`, `POST /admin/nutrition/parameters/:id/copy-to-draft` e `POST /admin/nutrition/parameters/publish`, sem mercado;
- `GET|PUT /admin/settings/company`, com os campos do `PUT` em `profile`;
- `GET /admin/legal/:kind`, `GET /admin/legal/:kind/versions/:version` e `POST /admin/legal/:kind`;
- `GET|PUT /admin/settings/automated-emails`.

Os erros 422 trazem `details.code` e `details.fields`.

## Decisions

### 1. Duas páginas com abas, como Frete

As duas páginas usam o padrão de `ShippingPage`: `PageFrame`, botões de mercado quando há dois, abas `page-tabs` e estado na URL (`?aba=` e `?mercado=`). A aba Fatores não tem mercado, porque o conjunto vale para os dois.

### 2. Mercado de quem não tem mercado atribuído

A veterinária pode não ter mercado atribuído, e a API aceita os dois mercados para ela. Por isso as páginas oferecem `sessionMarkets(user)` e, se a lista vier vazia, BR e US.

### 3. Prévia obrigatória antes de salvar limites e raças

"Salvar" chama a prévia primeiro. Com zero mudanças, salva direto. Acima de zero, abre um `Dialog` com a contagem por transição e só grava depois de "Confirmar". A prévia não grava nada.

### 4. Fatores editados como formulário, não JSON

Cada fator vira um campo numérico agrupado (combinação, estado, base, NEM). Os grupos de raça são listas de texto, uma raça por linha. "Salvar rascunho" envia o conjunto inteiro. Os campos que a API devolve em `fields` ficam marcados. O rascunho começa como cópia do publicado quando não existe.

### 5. Documentos legais publicados por inteiro

O painel não tem rascunho: o texto é editado num `textarea` com a versão `AAAA-MM-DD` (padrão: hoje) e publicado. O histórico abre o corpo de uma versão antiga só para leitura. Uma versão publicada não é editada.

### 6. Erros em português

Os códigos `life_stage_limits_invalid`, `life_stage_breed_invalid`, `life_stage_breed_exists`, `nutrition_parameters_invalid`, `nutrition_draft_missing`, `company_profile_invalid`, `legal_version_taken`, `legal_document_invalid` e `automated_email_settings_invalid` viram mensagens em português que nomeiam os campos.
