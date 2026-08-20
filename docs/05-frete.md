# Frete (configuracao administrativa)

## Nome da funcionalidade

Frete.

Menu: **Eden Bowl Nutrition → Frete** (`admin.php?page=hsr-shipping`).

Codigo:

- UI: `headless-secure-registration/src/shipping/presentation/class-shipping-admin-page.php`
- Persistencia: `.../infrastructure/class-shipping-settings-repository.php` (option `hsr_shipping_settings`)
- Calculo BR: `CalculateShippingUseCase` + `ShippingFeeCalculator`
- Cotacao US: `GetFixedShippingQuote::forUs()`

## Objetivo

Configurar como o checkout headless cobra frete em dois mercados:

- Brasil: preco por km a partir de um centro de distribuicao.
- Estados Unidos: valor fixo + carrier/prazo/label.

Problema de negocio: operacao precisa ajustar preco, cobertura e CD sem deploy.

Atores: Colaborador e Administrador (`manage_woocommerce` ou `manage_options`).

## Pre-condicoes

- Usuario autorizado.
- Para o teste de CEP funcionar: CD com lat/lng != 0,0; ViaCEP/Nominatim/OSRM alcancaveis.

## Fluxo da tela

Duas abas (`?tab=br` default, `?tab=us`).

### Salvar

POST + nonce `hsr_shipping_settings` + `hsr_shipping_action=save`.

- Salva **somente a aba visivel** (BR ou US). A outra metade do option permanece.
- Notice verde: "Settings saved."
- Permanece na mesma aba.

### Testar CEP (so aba BR)

POST + mesmo nonce + `hsr_shipping_action=test_cep`.

```
CEP informado
  → CalculateShippingUseCase::execute(cep, 'BR', applyRateLimit=false)
  → sucesso: notice info com distancia, fonte, R$ frete, prazo, se piso foi aplicado
  → erro: notice error com message + error code
```

**[REGRA CONFIRMADA]** O teste **nao aplica rate limit** (`false`). A API publica de frete aplica.

Nao ha redirect.

## Regras de negocio — Brasil (preservar)

Formula **[REGRA CONFIRMADA]**:

```
distancia_km = distancia_rota_m / 1000
se fonte == haversine_fallback: distancia_km *= road_factor
se distancia_km > max_distance_km (quando max > 0): recusa out_of_coverage
raw = distancia_km * per_km
shipping = raw
se min_fee > 0 e shipping < min_fee: shipping = min_fee   (piso, nao taxa somada)
se max_fee numerico e shipping > max_fee: shipping = max_fee
dias = ceil(distancia_km / km_per_day), limitado a [min_days, max_days], minimo 1
```

**[REGRA CONFIRMADA]** `min_fee` nao e adicional. E piso.

**[REGRA CONFIRMADA]** `max_fee` vazio/null = sem teto.

**[REGRA CONFIRMADA]** Se lat/lng do CD mudam no save, `center.version` vira `time()`. A descricao da UI diz que isso invalida cache de rotas (a chave de cache inclui a version do CD).

**[REGRA CONFIRMADA]** Frete BR desligado (`enabled=false`) faz o use case retornar `shipping_disabled` (422). Checkout nao calcula km.

**[REGRA CONFIRMADA]** Calculo por km so aceita country BR. US nesta tela e outro modelo.

Cadeia de integracao no teste/API:

1. Normaliza CEP para 8 digitos.
2. ViaCEP resolve cidade/UF.
3. Nominatim geocodifica.
4. OSRM rota CD → destino; fallback Haversine * road_factor.

## Regras de negocio — Estados Unidos (preservar)

**[REGRA CONFIRMADA]** Cotacao fixa, sem distancia:

```
cost = us.cost (default 12.90)
currency = USD
tax_total = 0
label / carrier / delivery = textos configuraveis
rate_id = fixed_us:default
```

`enabled=false` persiste no option. **[DUVIDA]** se o checkout consulta `us.enabled` antes de oferecer a cotacao; a classe `GetFixedShippingQuote::forUs()` **nao checa enabled** — so le cost/label. Verificar o caller no checkout (fora desta tela). Nao afirmar bloqueio US so pela UI.

## Validacoes

Save BR:

| Campo | Tratamento |
|---|---|
| enabled | checkbox presente = true |
| per_km, road_factor, min_fee, max_distance, km_per_day | float (defaults se ausentes: 0.95, 1.3, 0, 500, 80) |
| min_days, max_days | int (2, 10) |
| max_fee | string vazia → null |
| lat/lng | float |
| textos | sanitize_text_field |

Save US: enabled, cost float default 12.90, carrier default FedEx, delivery/label strings.

Tab invalida → forca `br`.

CEP teste: validacao real no use case (8 digitos). Campo HTML sem mascara obrigatoria.

## Campos BR

| Campo | Tipo | Default | Notas |
|---|---|---|---|
| enabled | bool | true | "Calcular frete por KM no Brasil" |
| label | string | Entrega Eden Bowl | label checkout |
| center.name/street/city/state/zipcode | string | '' | |
| center.lat/lng | float | 0 | 0,0 impede calculo (`route_failed`) |
| center.version | string | time | auto se lat/lng mudam |
| rule.per_km | float | 0.95 | R$/km |
| rule.road_factor | float | 1.3 | so fallback Haversine |
| rule.min_fee | float | 0 | 0 desliga piso |
| rule.max_fee | float\|null | null | vazio = sem teto |
| rule.max_distance_km | float | 500 |  |
| rule.km_per_day | float | 80 | prazo |
| rule.min_days | int | 2 | |
| rule.max_days | int | 10 | |

## Campos US

| Campo | Tipo | Default |
|---|---|---|
| enabled | bool | true |
| cost | float USD | 12.90 |
| carrier | string | FedEx |
| delivery | string | 3–5 business days |
| label | string | FedEx 3–5 business days |

## APIs / Endpoints desta tela

Nenhum REST disparado pelo form. O teste chama o use case in-process.

A API de checkout (referencia, nao e esta tela): rotas em `ShippingApi`.

## Banco de dados

Option `hsr_shipping_settings` (autoload false). Sem CPT.

Cache de rotas: transients WP (invalidado pela version do CD).

## Integracoes

- ViaCEP
- Nominatim
- OSRM
- Haversine (fallback)

Classificacao: Integracao. Preservar o contrato de cotacao (distancia, fonte, breakdown), nao necessariamente os mesmos provedores.

## Permissoes

Menu e render: `manage_woocommerce` ou `manage_options`. Nonce `hsr_shipping_settings`.

## Dependencias

- HSR shipping module
- Rede de saida para geocode/rota no teste
- Checkout headless que le o mesmo option

## Tratamento de erros do teste CEP

Codigos observados no use case: `country_not_supported`, `shipping_disabled`, `invalid_zipcode`, `route_failed`, `out_of_coverage`, erros ViaCEP/Nominatim/OSRM, rate limit (nao no teste admin).

UI: `message (code)`.

## Estados

- Aba BR / US
- Notice sucesso save
- Notice info cotacao
- Notice erro cotacao

Sem loading alem do POST nativo.

## Observacoes para migracao

- Entidade `ShippingSettings` com dois perfis de mercado (BR distance, US flat).
- Motor de cotacao BR e regra de negocio critica do checkout; a tela admin e CRUD dessa config + sandbox de CEP.
- Expor na UI nova se US `enabled=false` realmente bloqueia o checkout (hoje a UI tem o checkbox; o quote helper nao consulta).
- Preservar: piso ≠ taxa extra; teto opcional; recusa por distancia maxima; versionamento do CD para cache.
