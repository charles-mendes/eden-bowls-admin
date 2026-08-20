# Simulador Nutricional (Eden Bowl Nutrition)

## Nome da funcionalidade

PawBowl — Simulador Nutricional.

Menu: **Eden Bowl Nutrition** (`admin.php?page=hsr-nutrition-simulator`).

Codigo: `headless-secure-registration/src/class-nutrition-simulator-admin-page.php`  
Motor: `class-nutrition-recommendation-service.php`  
Racas: `class-breeds-repository.php` / tabela `wp_hsr_breeds`

## Objetivo

Permitir que nutricionista ou operador **valide o calculo de energia e quantidade de alimento** para um pet, usando o mesmo motor do onboarding, sem criar sessao, pedido ou assinatura.

Problema de negocio: conferir se a recomendacao apresentada ao cliente faz sentido antes/depois do atendimento.

Atores: Nutricionista, Colaborador, Administrador.

## Pre-condicoes

- Usuario com `access_pawbowl_nutrition` ou `manage_options`.
- Tabela de racas populada (`BreedsImporter::import_if_empty` no boot do plugin).

## Fluxo principal

1. Usuario abre o menu Eden Bowl Nutrition.
2. Formulario e preenchido com defaults (pais US, cachorro adulto, 4 anos, 20 kg, castrado, atividade BAIXO, score ADEQUADO).
3. Usuario clica **Gerar recomendacao** (POST).
4. Backend valida nonce `hsr_nutrition_simulate`.
5. Monta `$pet` + `$questionnaire` e chama `NutritionRecommendationService::build_for_pet`.
6. Se o servico devolve `error`, exibe notice vermelha e nao mostra painel de resultado.
7. Se ok, renderiza cards de alimento/refeicao/energia/refeicoes + resumo do pet + parametros.

Nao ha redirect apos o POST: a pagina re-renderiza com o formulario preenchido e o resultado abaixo.

## Fluxos alternativos

- Troca de pais no select: JavaScript reconstrói o select de racas (US=en, BR=pt) e **zera a raca selecionada**. **[REGRA CONFIRMADA]** regra de interface.
- Raca do pais anterior que nao existe no novo pais: valor do select fica vazio. **[REGRA CONFIRMADA]**
- Peso <= 0: motor retorna erro `Peso invalido. Informe peso maior que zero.` **[REGRA CONFIRMADA]** validacao.

## O que o usuario pode fazer

- Simular (unica acao de negocio).
- Nao salvar, nao exportar, nao historico.

**[REGRA CONFIRMADA]** A simulacao e **efemera**. Nada e persistido.

## Regras de negocio (motor)

Entrada do admin → processamento → saida.

```
Formulario admin
  → pet {name, type, life_stage, age, weight, breed, sex, size='', neutered}
  → questionnaire {nivel_atividade, score_corporal, nem_kcal_kg=3600}
  → locale = BR ? pt-BR : en-US
  → NutritionRecommendationService::build_for_pet
  → energia_kcal_dia, quantidade_g_dia, refeicoes, quantidade_por_refeicao, fator, porte, especie, nem
```

Formula central **[REGRA CONFIRMADA]** (preservar):

> `energia_kcal_dia = fator * peso_kg ^ 0.75`  
> `gramas_dia = round((energia_kcal_dia / nem_kcal_kg) * 1000)`  
> `gramas_refeicao = round(gramas_dia / refeicoes)`

### NEM

**[REGRA CONFIRMADA]** O admin **forca** `nem_kcal_kg = 3600` no questionnaire, para qualquer especie.

O motor, se NEM viesse vazio, usaria 3600 (cao) ou 3800 (gato). Como o admin sempre envia 3600, **gato no simulador usa NEM de cao**.

Classificacao: regra de interface do simulador (nao necessariamente a regra do onboarding). **[DUVIDA]** se isso e intencional. Na nova stack, alinhar simulador e onboarding; nao copiar o 3600 cego sem confirmar com nutricionista.

### Fator — precedencia **[REGRA CONFIRMADA]** (preservar)

1. Fator-base por especie/idade/atividade/raca (ver tabela abaixo).
2. Override por estado fisiologico (SENIOR=95, GESTANTE=132, CRESCIMENTO=140 se so `puppy`).
3. Override raca gigante (Dogue Alemao, Great Dane, Irish Wolfhound, etc.) → 200.
4. Override metabolismo lento (Sao Bernardo) → 95.
5. **Tabela de combinacao castrado + atividade + score tem a maior precedencia** e sobrescreve os passos anteriores quando a chave existe.
6. Ajustes de gato (242 / 134) so se a combinacao **nao** existir — na pratica a tabela cobre as combinacoes SIM/NAO × BAIXO/MODERADO/ALTO × ABAIXO/ADEQUADO/ACIMA, entao o override de gato raramente aplica quando score/atividade estao preenchidos.

Tabela de combinacao (castrado-atividade-score → fator):

| Chave | Fator |
|---|---|
| SIM-BAIXO-ABAIXO | 95 |
| SIM-BAIXO-ADEQUADO | 85 |
| SIM-BAIXO-ACIMA | 75 |
| SIM-ALTO-ABAIXO | 95 |
| SIM-ALTO-ADEQUADO | 95 |
| SIM-ALTO-ACIMA | 85 |
| SIM-MODERADO-ABAIXO | 95 |
| SIM-MODERADO-ADEQUADO | 85 |
| SIM-MODERADO-ACIMA | 75 |
| NAO-BAIXO-ABAIXO | 100 |
| NAO-BAIXO-ADEQUADO | 95 |
| NAO-BAIXO-ACIMA | 85 |
| NAO-ALTO-ABAIXO | 100 |
| NAO-ALTO-ADEQUADO | 95 |
| NAO-ALTO-ACIMA | 85 |
| NAO-MODERADO-ABAIXO | 85 |
| NAO-MODERADO-ADEQUADO | 95 |
| NAO-MODERADO-ACIMA | 85 |

Fator-base cao (quando a combinacao ainda nao ganhou):

- growth_stage mapeado (CRESCIMENTO_ATE_50=210, 51_80=175, 81_100=140)
- atividade ALTO + work_dog → 165
- atividade MODERADO + high_impact → 125
- idade 1–2 anos → 130
- idade 3–7 anos → 110
- raca Terranova/Newfoundland → 105
- score ACIMA → 80
- senao → 95

**[REGRA CONFIRMADA]** O formulario admin **nao envia** `work_dog`, `high_impact`, `growth_stage`, `age_months`, `size`. Esses ramos do motor existem para o onboarding, nao para esta tela.

### Porte

O campo `size` existe no array default/POST mas **nao e renderizado**. Sempre vai vazio.

**[REGRA CONFIRMADA]** Porte e classificado pelo peso (so cao):

| Peso (kg) | Porte |
|---|---|
| <= 5 | mini |
| <= 10 | pequeno |
| <= 25 | medio |
| <= 40 | grande |
| > 40 | gigante |

Gato: porte vazio.

### Refeicoes

**[REGRA CONFIRMADA]**

- Gato → 3
- Cao em CRESCIMENTO (life_stage puppy) → 3
- Demais → 2

`life_stage` adult/senior nao e CRESCIMENTO. Senior no motor vira estado SENIOR (fator 95) **antes** da tabela de combinacao; a combinacao ainda vence.

### Sexo

O select sexo e enviado no `$pet['sex']` mas **o motor ignora sexo**. **[REGRA CONFIRMADA]** campo de interface sem efeito no calculo.

### Nome do pet

Opcional. So aparece no resumo visual.

## Validações

| Campo | Frontend | Backend |
|---|---|---|
| country | select US/BR | se nao for US/BR, forca US |
| age | number min 0 step 1 | `max(0, int)` |
| weight | number min 0 step 0.1 | `max(0, float)`; motor rejeita <= 0 |
| type | dog/cat | normaliza gato/cat → cat, resto → dog |
| nonce | hidden | `check_admin_referer('hsr_nutrition_simulate')` |

Nao ha required HTML no nome/raca.

## Campos

| Campo | Tipo | Obrigatorio | Default | Valores |
|---|---|---|---|---|
| country | enum | sim (select) | US | US, BR |
| pet_name | string | nao | '' | livre |
| type | enum | sim | dog | dog, cat |
| life_stage | enum | sim | adult | puppy, adult, senior |
| age | int anos | nao (0 permitido) | 4 | >= 0 |
| weight | float kg | sim para calcular | 20 | > 0 |
| breed | string | nao | '' | nomes da tabela de racas do idioma do pais |
| sex | enum | nao | '' | '', male, female |
| neutered | bool | nao | true (checkbox marcado) | presente no POST = true |
| nivel_atividade | enum | sim | BAIXO | BAIXO, MODERADO, ALTO |
| score_corporal | enum | sim | ADEQUADO | ABAIXO, ADEQUADO, ACIMA |

## Exibicao do resultado (regra de interface)

**[REGRA CONFIRMADA]** Unidades dependem do pais do formulario, nao do locale WP:

- BR: g/dia e kg/dia; peso em kg.
- US: oz/day e lb/day; peso convertido kg → lb (`kg / 0.45359237`).
- Energia sempre em kcal (inteiro).

Labels do painel de resultado: ingles se pais != BR; portugues se BR.

## APIs / Endpoints

Nesta tela: **nenhum REST**. POST classico no admin.

O mesmo motor e exposto ao app em `NutritionSimulationApi` (fora do escopo desta tela). Na nova stack, simulador admin e onboarding devem chamar o **mesmo servico**.

## Banco de dados

Leitura:

- `wp_hsr_breeds` via `BreedsRepository::search('', 'en'| 'pt', 500)` para popular o select.

Escrita: nenhuma.

## Integracoes

Nenhuma API externa nesta tela.

## Permissoes

- Menu: `access_pawbowl_nutrition`
- Render: `access_pawbowl_nutrition` OU `manage_options`
- Nonce: `hsr_nutrition_simulate`

Sem nonce valido: WP die (falha de CSRF).

## Dependencias

- Plugin `headless-secure-registration`
- Tabela de racas
- Nao depende de WooCommerce para calcular (so para o usuario estar no admin)

## Tratamento de erros

| Situacao | Mensagem |
|---|---|
| Sem permissao | "You do not have permission to access this page." |
| Peso invalido | "Peso invalido. Informe peso maior que zero." |
| Nonce invalido | die padrao WP |

Nao ha estado de loading alem do submit HTML nativo.

## Estados da funcionalidade

- Vazio (GET inicial, sem resultado)
- Erro de calculo (notice)
- Sucesso (painel de metricas)

## Observacoes para migracao

- Reusar o motor unico; nao duplicar fatores na UI.
- Decidir NEM de gato no simulador (hoje 3600 hardcoded).
- Nao persistir simulacoes a menos que o produto peca historico (hoje nao existe).
- Campo sexo e tamanho visual: ou implementar no motor ou remover da UI.
- Racas: entidade propria (id + nome en/pt), nao string solta.
