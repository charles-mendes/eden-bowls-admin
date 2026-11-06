# Tasks

Rode só os testes relacionados (`npx vitest run <arquivo>` ou `npx vitest related <arquivos> --run`).

## 1. Tipos e textos

- [x] 1.1 `src/lib/courierDeliveries.ts`: `nfe?: { id: number; status: NfeStatus; number: string | null } | null` no item, `nfe_required?: boolean` na fila, `courierNfeState(nfe, required)` e o texto de `courier_nfe_not_authorized` em `courierErrorText`; simulação em `src/test/fixtures.ts`.

  Verificar: `src/lib/courierDeliveries.test.ts` novo (cada status com a trava ligada ("Aguardando NF-e: …") e desligada ("NF-e: …"), autorizada com e sem número, `null`, `href` só para rejeitada, erro e sem CPF, com a trava ligada ou não, e nunca para cancelada; o texto do erro com e sem `nfe_status`).

## 2. Entregas Brasil

- [x] 2.1 `CourierDeliveriesPage.tsx`: a linha de "A despachar" e de "Falhas" mostra o estado da nota, com link quando houver, e "Despachar"/"Despachar de novo" fica `disabled` com o motivo quando a nota trava.

  Verificar: `CourierDeliveriesPage.test.tsx` (autorizada despacha; em emissão e sem nota travam; "Falhas" com nota cancelada trava; trava desligada não trava; link para `/operations/nfe/:id`; um despacho recusado com `courier_nfe_not_authorized` mostra o texto).

## 3. Hoje

- [x] 3.1 `src/lib/today.ts` (`courierAwaitingNfe?: number | null`) e `fulfillmentItems`: "N pedidos a despachar aguardando NF-e" com o Brasil na tela, levando a `/operations/courier`.

  Verificar: `DashboardPage.test.tsx` (2 mostra o item; `null` e ausente não mostram; com a tela nos EUA não mostra).

## 4. Fechamento

- [x] 4.1 `npx vitest related` sobre os arquivos alterados, `npx tsc --noEmit -p tsconfig.app.json`, `npm run build` e lint sem erro novo.
