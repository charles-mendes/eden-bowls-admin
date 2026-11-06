# Design

## Context

- `CourierDeliveriesPage.tsx` desenha a linha (`RecipientCell`, `AddressCell`, o estado do problema de endereço) e mostra "Despachar" só com `shipping.write`, nas abas "A despachar" e "Falhas", e sem `item.issues` de endereço.
- `CourierDispatchDialog` (em `components/shipping/CourierDelivery.tsx`) é o mesmo em Entregas Brasil e no detalhe da assinatura, e mostra erros com `courierErrorText`.
- `src/lib/nfe.ts` já tem `NfeStatus` e `nfeStatusLabel`.
- `fulfillmentItems` em `DashboardPage.tsx` monta os itens de expedição do Hoje por mercado.

## Goals / Non-Goals

**Goals:**

- Uma função decide, por linha, se a nota segura a caixa e com qual texto, usada pela linha e pelos testes.

**Non-Goals:**

- Repetir "Nova tentativa" na linha do courier: ela continua no detalhe da nota.
- Filtro da fila por "aguardando NF-e": o Hoje leva à aba "A despachar", onde as linhas travadas já dizem o motivo.
- Indicador da trava no detalhe da assinatura: a seção de NF-e dele já mostra a nota, e um despacho recusado mostra o texto do erro.

## Decisions

- **`courierNfeState(nfe, required)` em `src/lib/courierDeliveries.ts`.** Devolve `{ text, blocks, href }`:
  - `authorized`: "NF-e {número}" (ou "NF-e autorizada" sem número), sem trava;
  - outro status ou `null`: "Aguardando NF-e: {motivo}" com `blocks = required`, e `href` para `/operations/nfe/{id}` em `rejected`, `error` e `blocked_missing_document`;
  - motivos: `null` → "sem nota registrada", `pending`/`submitted` → "em emissão", `blocked_missing_document` → "falta CPF ou nome fiscal", `rejected` → "rejeitada", `error` → "com erro", `canceled` → "cancelada".
  Com a trava desligada, o mesmo motivo aparece em tom neutro (sem "Aguardando"), para não sugerir que a caixa está presa: "NF-e: em emissão". O `href` não depende da trava; `canceled` nunca tem link, porque não entra em "Nova tentativa".
- **Botão indisponível, não escondido.** `disabled` com `title` e texto do motivo ao lado, para o operador ver que a ação existe e por que não pode. Alternativa: esconder como no problema de endereço. Descartada: a nota resolve sozinha em minutos, e o botão volta sem recarregar o raciocínio.
- **Campos opcionais.** `nfe?` e `nfe_required?` no tipo da fila; sem eles, `courierNfeState` não é chamada e a linha fica como hoje (backend antigo).
- **Erro no mesmo `courierErrorText`.** `courier_nfe_not_authorized` monta o texto com `details.nfe_status`, pelos mesmos motivos de `courierNfeState`. Assim Entregas Brasil e o detalhe da assinatura dizem o mesmo.

## Risks / Trade-offs

- [A nota autoriza enquanto a tela está aberta] → o botão só volta ao recarregar a fila; o despacho seguinte já passa. Aceitável: a fila recarrega a cada ação.
- [Backend com trava e painel antigo] → o despacho é recusado e o painel antigo mostra a mensagem crua da API. Subir os dois juntos.
