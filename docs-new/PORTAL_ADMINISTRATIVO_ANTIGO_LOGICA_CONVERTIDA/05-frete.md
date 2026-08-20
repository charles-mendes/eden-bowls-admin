# Frete (configuração administrativa)

## Origem WP

Submenu **Frete** (`admin.php?page=hsr-shipping`): abas BR (km) e US (fixo), save da aba visível, teste de CEP sem rate limit.

## O que o backend já tem

| Peça | Path / módulo | Estado |
|---|---|---|
| Motor BR | `src/core/shipping-fee.js` + `ShippingService.calculate` | Implementado |
| Settings load | `src/infrastructure/shipping/shipping-settings.js` | JSON `data/shipping-settings.json` + overlay env `SHIPPING_*` |
| Cotação BR (loja) | `POST /shipping/v1/calculate` | Pública, sem JWT. Body `{ zipCode, country }` |
| Settings públicos | `GET /shipping/v1/settings?country=US\|BR` | Pública; **não devolve** lat/lng do CD nem `per_km` / teto / prazo |
| Snapshot no checkout | `POST /api/v1/onboarding/shipping` | JWT do **cliente**; não é admin |

Defaults atuais do arquivo (`DEFAULT_SETTINGS`): BR `per_km=0.95`, `road_factor=1.3`, `min_fee=0`, `max_fee=null`, `max_distance_km=500`, `km_per_day=80`, `min_days=2`, `max_days=10`, CD lat/lng `0,0`. US `cost=12.9`, FedEx 3–5 business days, `enabled=true`.

A loja já cotiza com o mesmo motor. O portal precisa **CRUD da config** + sandbox de CEP. **Não há save admin hoje** — só load file/env.

## Regras a preservar (BR)

```
distancia_km = rota_m / 1000
se fonte == haversine_fallback: distancia_km *= road_factor
se max_distance_km > 0 e distancia > max → recusa out_of_coverage
raw = distancia_km * per_km
shipping = raw
se min_fee > 0 e shipping < min_fee → shipping = min_fee   // piso, não taxa somada
se max_fee numérico e shipping > max_fee → shipping = max_fee
dias = ceil(km / km_per_day) limitado a [min_days, max_days], mínimo 1
```

- `enabled=false` → `shipping_disabled` (422). Checkout não calcula km.
- CD `lat/lng` 0,0 → `route_failed`.
- Mudar lat/lng → incrementa `center.version` (invalida cache de rotas).
- `road_factor` **não** se aplica sobre distância OSRM.
- Só country BR neste modelo.

Cadeia: CEP 8 dígitos → ViaCEP → Nominatim → OSRM (fallback Haversine × `road_factor`).

Códigos de erro do teste (exibir `message (code)`): `country_not_supported`, `shipping_disabled`, `invalid_zipcode`, `route_failed`, `out_of_coverage`, falhas ViaCEP/Nominatim/OSRM.

## Regras a preservar (US)

Cotação fixa: `cost` (default 12.90), `currency=USD`, `tax_total=0`, `rate_id=fixed_us:default`, textos carrier/delivery/label.

No WP, `GetFixedShippingQuote::forUs()` **não lia** `us.enabled`. No Node, `getPublicSettings('US')` **já devolve** `enabled`. **Conversão:** se `enabled=false`, a loja não deve oferecer a rate. O portal mostra o checkbox com esse efeito real.

## UI alvo

Rota React: `/config/shipping` (**criar**). Não misturar com `BusinessRulesPage` genérico.

Abas BR / US. Save só da aba visível **ou** PUT com o objeto inteiro — o backend faz merge e **não apaga** a outra metade.

Teste CEP (só aba BR): mesmo `ShippingService.calculate` **sem** rate limit extra de abuse da loja. A rota pública já está sob o limiter global 300/min; a rota admin encapsula e não aplica limiter adicional.

Sem redirect após save; notice “Settings saved.” e permanece na aba.

## Rotas backend

### Reutilizar no teste (não recomendado como UX)

```
POST /shipping/v1/calculate
{ "zipCode": "01310-100", "country": "BR" }
```

É pública. O admin autenticado **pode** chamá-la, mas mistura contrato da loja com o portal.

### Criar

```
GET  /api/v1/admin/shipping/settings
PUT  /api/v1/admin/shipping/settings
POST /api/v1/admin/shipping/test
```

Permissions: `shipping.read` / `shipping.write`. Teste: `shipping.write` ou `shipping.read`.

`GET /shipping/v1/settings` é **público e resumido**. Não serve para o form.

Body PUT (merge por mercado):

```json
{
  "br": {
    "enabled": true,
    "label": "Entrega Eden Bowl",
    "center": {
      "name": "CD",
      "street": "",
      "city": "",
      "state": "",
      "zipcode": "",
      "lat": -23.5,
      "lng": -46.6
    },
    "rule": {
      "per_km": 0.95,
      "road_factor": 1.3,
      "min_fee": 0,
      "max_fee": null,
      "max_distance_km": 500,
      "km_per_day": 80,
      "min_days": 2,
      "max_days": 10
    }
  },
  "us": {
    "enabled": true,
    "cost": 12.9,
    "carrier": "FedEx",
    "delivery": "3–5 business days",
    "label": "FedEx 3–5 business days"
  }
}
```

Validações (paridade WP):

- `per_km`, `road_factor`, `min_fee`, `max_distance_km`, `km_per_day` → float (defaults se ausentes).
- `min_days`, `max_days` → int (2, 10).
- `max_fee` vazio → `null` (sem teto).
- US `cost` default 12.90.

Persistência: escrever `data/shipping-settings.json` **ou** tabela `shipping_settings`. Env `SHIPPING_*` continua overlay de runtime (como hoje). Se env estiver setado, a UI mostra aviso “valor efetivo vem do ambiente” — não dual-write silencioso (o WP tinha esse problema com chaves Stripe).

Ao mudar lat/lng, o service incrementa `center.version`.

Teste:

```
POST /api/v1/admin/shipping/test
{ "zipCode": "01310100", "country": "BR" }
```

Resposta de sucesso: distância, fonte (`osrm` / `haversine_fallback`), valor, prazo, se piso foi aplicado. Sem persistir.

## Relação com `BusinessRulesPage`

A tela atual `PUT /admin/config/business-rules/:id` **não existia no WP**. Frete era option dedicada. **Não** modelar `per_km` como regra JSON genérica se já existe `ShippingSettings`. Manter `business-rules` só se o produto tiver outras policies (`price-zone-policy` já tem entidade). Frete fica nesta tela.

## O que não copiar

- Nonce / save só-via-POST HTML.
- Dual source “option vs env” sem deixar claro qual vence (hoje env overlay vence — documentar na UI).
- Rate limit da API pública no clique de teste do operador (WP desligava de propósito).
- Assumir que o checkbox US `enabled` no WP bloqueava checkout (não bloqueava; no Node, sim).
