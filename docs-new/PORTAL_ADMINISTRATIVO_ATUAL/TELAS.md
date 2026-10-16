# Lógica das telas

Cada página autentica via `useAuth().token` e aborta o fetch se o token for nulo. Não há debounce nos filtros: cada keystroke dispara um novo request.

## Login — `/login`

Arquivo: `src/pages/LoginPage.tsx`.

- Campos: e-mail e senha.
- Já autenticado → `Navigate` para `location.state.from` ou `/dashboard`.
- Erro de login aparece no alerta; o botão desabilita enquanto `loading`.

## Dashboard — `/dashboard`

Arquivo: `src/pages/DashboardPage.tsx`. A tela abre em **Hoje** (`GET /admin/today`): números do dia, pendências e pedidos que precisam de ação.

### Saúde do sistema (só admin)

`<details>` recolhido no fim da página, renderizado só com `hasRole('admin')`. Componente: `src/components/SystemHealth.tsx`. Operator, readonly e nutritionist não veem a seção e não chamam as rotas abaixo.

| Bloco | Fonte | O que mostra |
|---|---|---|
| Webhooks Stripe | `GET /admin/billing/webhooks/health` | Uma linha por conta (Brasil, EUA): badge OK / Atenção / Sem eventos, último evento (hora · tipo), falhas em 24 h e eventos parados há mais de 1 h. Atenção = falha em 24 h, evento parado > 1 h ou nenhum evento há mais de 72 h. Erro → `div.alert`, nenhuma conta aparece como OK. |
| Preços Stripe no catálogo | `GET /admin/catalog/sync/health`, `GET /admin/catalog/sync/status` | Cobertura de Price IDs do mercado escolhido (seletor só para quem tem BR e US) e a última sincronização de cada mercado em `byMarket`: resultado, hora e, se falhou, a mensagem de erro. Sem execução → "nenhuma sincronização registrada". |
| Conflitos de mercado | `GET /admin/markets/conflicts?page&perPage=20` | Total e linhas (e-mail, mercado do perfil, conta Stripe), um por cliente + conta, com paginação. Lista vazia → "Nenhum conflito perfil vs Stripe." |

Os cards de checkout (Checkouts, Vinculados Stripe, Stripe ativos, Com simplificado) saíram desta seção; continuam em Onboarding 360.

## Frete — `/config/shipping`

Arquivo: `src/pages/ShippingPage.tsx`. Um escopo só: o mercado, num seletor no cabeçalho (Brasil / EUA, só para quem tem os dois). Abaixo, três abas por tarefa, todas do mercado escolhido:

| Aba | Conteúdo |
|---|---|
| Regras de entrega | BR: entrega local (raio, valor por km, taxas). EUA: modo de cotação (UPS ou valor fixo), serviços, caixa padrão, valor de reserva. Salva só as regras do mercado (`PUT /admin/shipping/settings` com `br` ou `us`). Selo **não salvo** quando há edição pendente. |
| Sede | Cartão da sede do mercado; endereço validado antes de salvar. Selo **pendente** sem endereço validado. Salvar a sede não descarta regras não salvas. |
| Simulador | CEP/ZIP → `POST /admin/shipping/test`. Usa as regras **salvas**; avisa quando há edição não salva e quando a sede necessária (BR sempre, EUA em modo UPS) não está validada, com atalho para a aba. |

- URL: `?aba=regras|sede|simulador&mercado=br|us`. Aba padrão: Regras para quem tem `shipping.write`, Simulador para os demais. O botão voltar do navegador troca de aba.
- Trocar de mercado com regras não salvas abre **Alterações não salvas**: Continuar editando, Descartar e trocar, ou Salvar e trocar (só com `shipping.write`). Nada é salvo no mercado errado.
- Sem `shipping.write`: nenhum botão de salvar nem de cadastrar endereço; campos desabilitados.

## Onboarding — `/onboarding/sessions`

Arquivo: `src/pages/OnboardingPage.tsx`.

Paralelo:

- `GET /admin/onboarding/sessions?page&perPage&status?`
- `GET /admin/onboarding/metrics`

Filtros: `status` (texto livre, placeholder `started`) e `perPage` (1–100).

KPIs: total de sessões, expiram em 24h, soma de `byStatus` (“Status ativos”), data de geração.

Tabela: id (link para detalhe), locale/country, status, e-mail do `linkedUser`, contagens `_count.sessionPets` / `answers` / `recommendationRuns`, `updatedAt`.

Paginação usa `totalPages` devolvido pela API (não calcula no cliente).

## Sessão 360 — `/onboarding/sessions/:id`

Arquivo: `src/pages/OnboardingSessionPage.tsx`.

`GET /admin/onboarding/sessions/:id`.

Blocos:

1. KPIs: status, qtd de pets, answers, runs.
2. Identidade (`locale`, `country`, `createdAt`) e usuário vinculado (`email`, `status`).
3. Tabela de `sessionPets`: ordem, nome, espécie, peso, activity, goal.
4. Tabela de `answers`: `questionKey`, JSON da resposta, `updatedAt`.
5. Cards de `recommendationRuns`: status, data, JSON de `petResults` e `planSnapshots`.
6. Cards de `checkoutOrders`: JSON de `orders` e `subscriptions`.

Somente leitura. Não há ação de expirar, vincular usuário ou reprocessar recommendation.

## Produtos — `/catalog/products`

Arquivo: `src/pages/ProductsPage.tsx`.

`GET /admin/catalog/products?search&market&page&perPage`.

Filtros:

- `search` — slug / nome pt / nome en (texto livre).
- `market` — default `BR`; input força uppercase.
- `perPage` — 1–100, default 20.

Tabela: nome pt/en, categoria pt/en, slug, mercados (`marketCountry/currency`), quantidade de variantes, ativo, `createdAt`.

A descrição da página fala em “atalhos para criação/edição”. **Não existem** formulário, botão de criar nem tela de edição.

## Preços — `/catalog/pricing`

Arquivo: `src/pages/PricingPage.tsx`.

`GET /admin/catalog/pricing?market&currency&page&perPage`.

Filtros default: mercado `BR`, moeda `BRL`. Ambos uppercase.

Tabela: produto (nome + slug), `variantId`, moeda, preço regular, promoção (`salePrice` + intervalo `saleFrom` → `saleTo`), `source`, `createdAt`.

Somente listagem. Sem criar/editar preço.

## Billing — `/billing`

Arquivo: `src/pages/BillingPage.tsx`.

É a tela com mais comportamento.

### Leitura

Em paralelo:

- `GET /billing/catalog/sync/health?market&currency`
- `GET /admin/billing/subscriptions?page&perPage&status?&market?`

Depois, de forma opcional (falha não derruba a página):

- `GET /billing/catalog/sync/status`

A listagem de assinaturas pagina com `subscriptionPage` e `perPage`.

### Mutações

**Sync geral** (`POST /billing/catalog/sync`):

```json
{ "market": "BR", "currency": "BRL" }
```

Espera `{ syncJobId, status }`. Mostra mensagem de sucesso e recarrega os dados.

**Sync por produto** (`POST /billing/catalog/sync/:productId`):

- Só dispara se `syncProductId` não estiver vazio.
- Sem body.
- Mesmo padrão de mensagem + reload.

### UI

- KPIs de health (expected, mapped, gaps) e status do job.
- Formulários lado a lado: sync de catálogo e sync por UUID de produto.
- Tabela de subscriptions: e-mail, termo (`marketCountry` + meses), status, auto renew, próximo billing, criado em.

Não há cancelamento de assinatura nesta tela.

## Regras de negócio — `/config/business-rules`

Arquivo: `src/pages/BusinessRulesPage.tsx`.

`GET /admin/config/business-rules` com:

| Query | Origem |
|---|---|
| `domain` | texto |
| `key` | texto |
| `marketCountry` | uppercase |
| `active` | omitido / `true` / `false` (select) |
| `page`, `perPage` | paginação |

No primeiro load bem-sucedido, se nada estiver selecionado, a primeira regra da página vira seleção: preenche o editor com `formatJson(valueJson)` e `effectiveTo`.

Clique na linha da tabela troca a seleção.

### Mutação

`PUT /admin/config/business-rules/:id`:

```json
{
  "valueJson": { "...": "JSON.parse do textarea" },
  "effectiveTo": "string ISO ou null se vazio"
}
```

Depois recarrega a lista com os mesmos filtros e tenta manter a regra pelo `id`. JSON inválido no textarea cai no `catch` genérico.

Não cria regra nova, não altera `domain`/`key`/`marketCountry`/`active`/`effectiveFrom`.

## Usuários — `/users`

Arquivo: `src/pages/UsersPage.tsx`.

Única listagem que **não** usa `page`/`perPage` na query. Converte para offset:

```
GET /admin/users?skip={(page-1)*perPage}&take={perPage}
```

Espera `{ total, skip, take, items }`.

Tabela: e-mail, status, `profile.fullName`, `profile.phone`, `createdAt`.

Sem busca, sem detalhe, sem alteração de papel.

## Pedidos — `/orders`

Arquivo: `src/pages/OrdersPage.tsx`.

`GET /admin/orders?page&perPage&status?`.

Status de domínio no cliente:

```
new → confirmed → preparing → shipped → delivered
cancelled (terminal)
delivered (terminal)
```

Clicar na linha seleciona o pedido. “Mudar status” também seleciona e sugere o **próximo** status (`nextStatusByCurrent`). Se o status atual não estiver no mapa, o select cai em `confirmed`.

No primeiro load, se nada estiver selecionado, usa o primeiro item da página.

### Mutação

`PATCH /admin/orders/:orderId/status`:

```json
{ "toStatus": "confirmed", "reason": "opcional" }
```

`reason` só entra no body se não for string vazia.

Ações na tabela: link “Ver detalhe” (`/orders/:id`) e botão “Mudar status”. O formulário lateral aplica a transição; o copy da tela deixa explícito que o detalhe permanece na API.

## Detalhe do pedido — `/orders/:orderId`

Arquivo: `src/pages/OrderDetailPage.tsx`.

`GET /admin/orders/:orderId`.

- KPIs: status, e-mail, qtd de itens, qtd de mudanças no histórico.
- Checkout: produto, SKU da variante, quantidade, preço (`priceCents / 100`). Linha extra de frete se existir `shippingSelection`.
- Histórico: `fromStatus` → `toStatus`, motivo (`formatJson` se houver), data.

Somente leitura. Para mudar status é preciso voltar à listagem.

## 404 — `*`

Arquivo: `src/pages/NotFoundPage.tsx`.

Card fora do layout. Link para `/dashboard`.
