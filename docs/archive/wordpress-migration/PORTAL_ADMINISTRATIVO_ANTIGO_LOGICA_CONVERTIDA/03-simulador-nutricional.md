# Simulador nutricional

## Origem WP

Menu **Eden Bowl Nutrition** (`admin.php?page=hsr-nutrition-simulator`). POST no admin, sem REST. Simulação **efêmera**.

Motor já portado: `src/core/nutrition-recommendation.js` (`DEFAULT_DOG_NEM = 3600`, `DEFAULT_CAT_NEM = 3800`, tabela `COMBINATION_FACTORS` idêntica ao WP).
Raças: `GET /api/v1/breeds?lang=pt|en&limit=500` (`BreedsService`; lang default `pt`; teto 500).
Onboarding da loja: `GET|POST /api/v1/onboarding/recommendation` — persiste recomendação no state do **próprio** JWT quando autenticado.

## Objetivo no portal

Nutricionista/operador valida energia e gramas **com o mesmo motor da loja**, sem criar pet, checkout ou assinatura.

Rota React alvo: `/nutrition/simulate` (**criar**). Menu visível para `admin`, `operator`, `nutritionist`. Este é o **único** destino do nutricionista.

## Regras a preservar

Fórmulas:

```
energia_kcal_dia = fator * peso_kg ^ 0.75
gramas_dia = round((energia / nem_kcal_kg) * 1000)
gramas_refeicao = round(gramas_dia / refeicoes)
```

Precedência do fator (já no core Node — não duplicar na UI):

1. Fator-base espécie/idade/atividade/raça.
2. Override fisiológico (SENIOR 95, GESTANTE 132, CRESCIMENTO).
3. Raça gigante → 200.
4. São Bernardo → 95.
5. **Tabela castrado + atividade + score vence tudo** quando a chave existe.

Tabela de combinação (castrado-atividade-score):

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

Refeições: gato → 3; cão CRESCIMENTO (`life_stage` puppy) → 3; demais → 2.

Porte do cão pelo peso: mini ≤5, pequeno ≤10, médio ≤25, grande ≤40, gigante >40 kg. Gato: vazio.

Peso ≤ 0 → erro (`Peso inválido…`). Não persistir.

Sexo no form WP **não entra no motor** — omitir na UI nova.

O form WP **não envia** `work_dog`, `high_impact`, `growth_stage`, `age_months`, `size`. O simulador admin pode continuar assim; o onboarding da loja usa o motor completo.

## NEM (não copiar o bug do admin WP)

O wp-admin forçava `nem_kcal_kg = 3600` inclusive para gato. O core Node, se NEM vier vazio, usa **3600 cão / 3800 gato**.

**Conversão:** o simulador **não envia NEM**. Deixa o motor default. Alinhado com a loja.

## UI

Campos (iguais ao WP, defaults US / dog / adult / 4 anos / 20 kg / castrado / BAIXO / ADEQUADO):

| Campo | Tipo | Obrigatório | Default |
|---|---|---|---|
| country | `BR` \| `US` | sim | `US` |
| pet.name | string | não | `''` |
| type | `dog` \| `cat` | sim | `dog` |
| life_stage | `puppy` \| `adult` \| `senior` | sim | `adult` |
| age | int ≥ 0 | não | 4 |
| weight | float kg > 0 | sim para calcular | 20 |
| breed | string | não | `''` (select das raças do idioma do país) |
| neutered | bool | não | `true` |
| nivel_atividade | `BAIXO` \| `MODERADO` \| `ALTO` | sim | `BAIXO` |
| score_corporal | `ABAIXO` \| `ADEQUADO` \| `ACIMA` | sim | `ADEQUADO` |

Troca de país: reconstrói o select de raças (`US` → `lang=en`, `BR` → `lang=pt`) e **zera a raça**. País inválido → forçar `US`.

Resultado: energia kcal; gramas/dia e por refeição; fator aplicado; porte; espécie; NEM usado.

Unidades pelo **país do form**, não pelo locale do browser:

- BR: g/dia, kg
- US: oz/day, lb (`kg / 0.45359237`) — o core já tem `convertWeight`

Labels do painel: português se BR, inglês se US.

Estados: vazio (GET inicial), erro de cálculo (alerta), sucesso (cards). Sem histórico, sem CSV, sem salvar.

## Rotas backend

### Reutilizar (parcial)

`GET /api/v1/breeds?search=&lang=pt|en&limit=500` — popular o select. Sem JWT. Default lang `pt`, default limit `10` — o simulador **deve** passar `limit=500`.

`POST /api/v1/onboarding/recommendation` já aceita `pets` no body e chama o mesmo service.

Problemas para o admin:

- Sem JWT calcula pelo body — ok para simulação.
- **Com** JWT de admin gravaria recomendação no `onboarding_user_state` **do admin**, não de um cliente.
- Resposta é o envelope da loja (`simplified` / packs), não o painel de kcal/fator.
- Não há permission `nutrition.simulate`.

**Não usar** a rota da loja no portal.

### Criar

```
POST /api/v1/admin/nutrition/simulate
Authorization: Bearer
permission: nutrition.simulate
```

Body:

```json
{
  "country": "BR",
  "pet": {
    "name": "Milo",
    "type": "dog",
    "life_stage": "adult",
    "age": 4,
    "weight": 20,
    "breed": "Labrador",
    "neutered": true
  },
  "questionnaire": {
    "nivel_atividade": "BAIXO",
    "score_corporal": "ADEQUADO"
  }
}
```

Handler: `NutritionRecommendationService` / `buildForPet` **sem** gravar `onboarding_user_state` e **sem** `userId`.

Resposta:

```json
{
  "success": true,
  "data": {
    "energia_kcal_dia": 0,
    "quantidade_g_dia": 0,
    "refeicoes": 2,
    "quantidade_por_refeicao": 0,
    "fator_aplicado": 0,
    "porte": "medio",
    "especie": "cao",
    "nem_kcal_kg": 3600,
    "display": { "daily": "…", "weight": "…" }
  }
}
```

Peso ≤ 0 → 422 `{ success: false, message: "Peso inválido. Informe peso maior que zero." }`.

Não criar GET. Não histórico.

## Permissão

| Papel | Acesso |
|---|---|
| nutritionist, operator, admin | sim |
| readonly | se o produto quiser (WP não tinha) |
| customer | não |

## O que não copiar

- Nonce `hsr_nutrition_simulate`.
- NEM 3600 cego para gato.
- Campo sexo sem efeito, a menos que o motor passe a usá-lo.
- Persistência / CSV / “salvar simulação”.
- Editor das tabelas de fator (hardcoded no core; não há tela WP).
