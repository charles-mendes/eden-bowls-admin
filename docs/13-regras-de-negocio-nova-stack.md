# Regras de Negocio para Implementacao na Nova Stack

Somente o que precisa sobreviver **independentemente** de WordPress, WooCommerce, options, nonces, CPT e hooks.

Nao inclui: slugs de menu, capabilities WP, AES no `AUTH_KEY`, transients, `admin-ajax.php`, HPOS, dashicons.

Marcacao: **[REGRA CONFIRMADA]** no codigo atual. Itens **[INFERENCIA]** ou **[DUVIDA]** nao entram aqui como obrigatorios.

---

## 1. Identidade, acesso e papeis

1. Existem tres papeis operacionais: **Administrador**, **Operador** e **Nutricionista**.
2. Nutricionista so executa **simulacao nutricional**. Nao ve pedidos, frete, Stripe, catalogo, usuarios.
3. Operador ve pedidos/clientes/catalogo, onboarding 360, frete, simulador, ledger Stripe e cupons. Nao precisa de ferramentas de CMS.
4. Administrador ve tudo o que o operador ve, mais ferramentas de plataforma (hoje: CPT Flexible Subscriptions, settings WP).
5. Os rotulos "Colaborador Brasil" e "Colaborador EUA" **nao isolam dados** no codigo atual. Nao implementar isolamento por mercado sem nova decisao de produto.
6. Toda acao mutavel exige autenticacao + autorizacao no servidor. CSRF/nonce WP vira token de sessao do painel novo.

---

## 2. Nutricao

1. Energia diaria = `fator * peso_kg ^ 0.75` (kcal).
2. Gramas/dia = `round((energia / NEM_kcal_kg) * 1000)`.
3. Gramas por refeicao = `round(gramas_dia / numero_refeicoes)`.
4. Tabela de combinacao `castrado(SIM|NAO) + atividade(BAIXO|MODERADO|ALTO) + score(ABAIXO|ADEQUADO|ACIMA)` tem **precedencia maxima** sobre fator-base, estado fisiologico e raca (valores na doc 03).
5. Overrides de raca gigante (fator 200) e Sao Bernardo (95) existem mas perdem para a tabela de combinacao quando a chave existe.
6. Gato: 3 refeicoes. Cao filhote/crescimento: 3. Demais caes: 2.
7. Porte do cao pelo peso: mini ≤5, pequeno ≤10, medio ≤25, grande ≤40, gigante >40 kg.
8. Peso deve ser > 0; caso contrario o calculo falha.
9. Simulador admin e onboarding devem usar o **mesmo motor**. Hoje o admin forca NEM=3600 inclusive para gato (o motor default de gato seria 3800). Alinhar com nutricionista; nao silenciar essa divergencia.
10. Simulacao do painel **nao persiste**.

---

## 3. Onboarding operacional (360)

1. Um pedido de onboarding e um pedido que carrega o identificador de sessao de onboarding.
2. A tela e **somente leitura**: nao corrige pet, nao retoma sessao, nao reenvia token, nao mexe em Stripe.
3. Recorrencia exibida e o **snapshot do onboarding** (`weekly|biweekly|monthly`), nao o intervalo vivo da Stripe.
4. Vinculo Stripe = presenca do id de assinatura no pedido; status Stripe = ultimo valor persistido (webhook/API), nao live query.
5. Recomendacao "simplificada" (diario / mensal / packs por pet) vem da sessao de onboarding, nao e recalculada so com o pedido.
6. Export CSV e a mesma consulta filtrada (no WP ha teto de 500 no scan profundo — na nova stack paginar/filtrar de verdade e avisar limites).
7. Pedido sem dados de onboarding deve mostrar empty state, nao erro.

---

## 4. Frete

### Brasil (distancia)

1. So mercado BR.
2. Pode ser desligado por configuracao; desligado → recusa cotacao.
3. Centro de distribuicao precisa de coordenadas; 0,0 impede cotacao.
4. Distancia oficial: rota rodoviaria (hoje OSRM). Fallback geodesico × `road_factor` (default 1.3). O fator **nao** se aplica sobre distancia OSRM.
5. Se distancia > `max_distance_km` (default 500, quando > 0) → fora de cobertura (nao cobra teto: recusa).
6. `preco = km * valor_por_km`.
7. `min_fee` e **piso** (substitui o preco se menor), nao taxa somada. 0 desliga.
8. `max_fee` opcional; vazio = sem teto.
9. Prazo em dias = `ceil(km / km_per_day)` limitado a `[min_days, max_days]`, minimo 1.
10. Mudar lat/lng do CD invalida cache de rotas (versionar o CD).

### Estados Unidos (fixo)

1. Valor unico configuravel (default 12.90 USD), carrier/prazo/label textuais.
2. Imposto de frete na cotacao fixa atual = 0.
3. Identificador de rate: `fixed_us:default`.

---

## 5. Catalogo / plano alimentar

1. Produto-plano tem **pais** BR ou US e **duracao em dias** > 0. Sem isso a API de plano rejeita (422).
2. BR ⇒ moeda BRL. US ⇒ USD. Nao misturar.
3. Composicao do plano (periodos, sabor, peso, subtotais) viaja no pedido como snapshot; o admin so **mostra**, nao edita.
4. Cada variacao comercializavel precisa de preco Stripe por moeda exigida. Sem mapping completo, o produto **nao deve ficar publicado**.
5. Publicar tenta sincronizar automaticamente; se ainda faltar price, volta para rascunho e avisa quais variacoes/moedas faltam.
6. Sync Stripe: um Product Stripe por variacao, nome `{produto} - {variacao}`; Price novo quando muda fingerprint `preco|moeda|intervalo`. Intervalo default mensal.
7. Variacao sem preco nao gera Price.

---

## 6. Pedido (visao operacional)

1. Snapshot de onboarding no pedido: sessao, pets, questionario/recorrencia, selecao de plano, CEP/endereco, payload de checkout.
2. Estado Stripe no pedido: subscription id/status, period end, ultimo webhook.
3. Desconto: promotion code, coupon id, percentual, valor abatido, duration, valor pago na Stripe, motivo de inelegibilidade se houver.
4. "Pago na Stripe" e "Desconto Stripe" sao **exibicao do que foi persistido**, nao recalculo do total Woo.
5. Cupom: link para o objeto na Stripe (test vs live conforme secret de runtime).

---

## 7. Assinaturas (ledger)

1. A listagem operacional le um **ledger local**, nao a API Stripe linha a linha.
2. Status persistidos sao os da Stripe: `active`, `trialing`, `past_due`, `unpaid`, `canceled`, `incomplete`, `incomplete_expired`, `paused`.
3. "Cancelando" = ainda ativa/trialing/past_due **e** `cancel_at_period_end`.
4. "Ativas" para KPI = `active` + `trialing`.
5. MRR estimado: soma mensalizada de `plan_amount` das active+trialing, por moeda, com conversao year/12, week×4.34524, day×30.4375, month composto `amount/interval_count`. Nao desconta quem esta cancelando no fim do periodo.
6. Renovacao 7d: `current_period_end` no intervalo (agora, agora+7d) e status active|trialing|past_due.
7. Canceladas 30d: status canceled e timestamp de cancelamento nos ultimos 30 dias.
8. Moedas zero-decimal nao dividem por 100 na formatacao.
9. Operador pode: filtrar/buscar, ver detalhe, abrir na Stripe, baixar PDF da invoice, ver faturas e frete recorrente auditado, exportar CSV desse frete, forcar reconcilicao, backfill de vinculo usuario↔customer, sync de invoices de uma assinatura.
10. Operador **nao** pausa/cancela/altera plano pelo painel atual (isso e da API do cliente). Nao inventar essas acoes no admin sem requisito novo.
11. Invoice PDF e redirect para URL da Stripe, nao arquivo local.
12. Frete recorrente auditado e item de invoice persistido (invoice.created), nao o metodo Woo.

---

## 8. Cupons de 1a compra

1. Stripe e a fonte de verdade do cupom. O app so mapeia `prazo → promotion_code_id`.
2. Prazos e percentuais travados: 1 mes = 10%, 3 meses = 25%, 6 meses = 40%.
3. Coupon: `duration=once`. Promotion Code: `first_time_transaction=true`.
4. O percentual maior de 3/6 meses e **beneficio de compromisso na primeira fatura**, nao desconto sobre o valor total do contrato. Meses seguintes cobram cheio.
5. Mapa incompleto (faltando promo de 1, 3 ou 6) **bloqueia checkout de cliente elegivel**.
6. Max redemptions 0 na Stripe = ilimitado la; elegibilidade de 1a compra continua sendo regra do backend PawBowl.
7. IDs de mapeamento devem ser `promo_...`.
8. Falhas de checkout por mapa ausente devem ser observaveis (hoje ha contador).

---

## 9. Cliente

1. Instrucoes de entrega sao texto livre no cadastro do cliente (mesmo dado do app).
2. Avatar/e-mail/senha/endereco de entrega sao do app (`/profile*`), nao telas admin custom — o admin WP nativo cobre o resto do usuario.

---

## 10. Pagamento

1. Nao ha caminho operacional para configurar gateway WooCommerce. Cobranca e Stripe.
2. Runtime de chaves Stripe e **ambiente** (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`), nao formulario admin. Se existir UI de chaves, e diagnostico, nao source of truth.
3. Webhook Stripe e o alimentador do ledger; replay, se existir, exige usuario autenticado, janela de tempo, limite de tentativas, rate limit por usuario, recusa de payload grande/inconsistente.
4. Kill-switch por tipo de evento (ignorar internamente sem mudar o endpoint na Stripe) existe no codigo; so repor se o modulo de ops for priorizado.

---

## 11. Integracoes que o painel assume

| Integracao | Papel |
|---|---|
| Stripe | Produtos/prices, assinaturas, invoices, PDF, cupons, dashboard |
| ViaCEP + geocode + OSRM | Cotacao BR (teste admin = mesma cadeia, sem rate limit) |
| Woo (hoje) | Pedidos, produtos, clientes — na nova stack viram entidades proprias |

---

## 12. O que **nao** copiar

- Dual write "option admin de chaves" vs env.
- Filtro de assinatura `status=canceling` que nao usa `cancel_at_period_end`.
- KPI cards do Onboarding 360 calculados so na pagina visivel.
- Scan profundo limitado a 500 pedidos sem aviso.
- Badge de status Stripe na variacao que ignora o mapping real.
- Link de produto Stripe sempre em modo live enquanto o resto respeita test/live.
- Dois roles regionais com as mesmas permissoes fingindo isolamento.
- NEM 3600 forcado no simulador para gato sem decisao explicita.
- Telas Stripe de dashboard/webhooks/logs como se ja estivessem no menu (nao estao).
- CPT Flexible Subscriptions como UI principal de operacao.

---

## 13. Mapa minimo de telas na nova stack

Equivalente funcional ao que o operador **consegue usar hoje**:

1. Simulador nutricional (sem persistencia).
2. Consulta Onboarding 360 (lista, detalhe, CSV).
3. Configuracao de frete BR/US + teste de CEP.
4. Catalogo de planos (pais, dias, variacoes, sync Stripe, bloqueio de publish incompleto).
5. Detalhe de pedido (snapshot onboarding + meal plan + desconto/pago Stripe).
6. Ledger de assinantes (KPI, lista, detalhe, faturas, frete auditado, sync).
7. Mapeamento/provisionamento de cupons de 1a compra.
8. Edicao de instrucoes de entrega no cliente.

Modulos no codigo mas **nao no menu**: observabilidade de webhook, diagnostico, toggles de evento — backlog, nao MVP, a menos que ops peca.
