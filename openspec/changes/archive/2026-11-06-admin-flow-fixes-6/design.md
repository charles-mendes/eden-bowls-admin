# Design

## Context

- `LabelQueuePage.tsx` já tem as seções "Prontos para etiqueta", "Verificar na UPS" (`#verificar-ups`) e "Etiquetas criadas", lidas de `GET /admin/shipments/queue`. A compra sem confirmação usa confirmação antes e "Fechar após conferir na UPS", e a coleta segue o mesmo jeito.
- `src/lib/upsLabels.ts` tem os tipos da fila e `upsErrorText` por código.
- `HeadquartersCard.tsx` monta o rascunho dos EUA com `name`, `street`, `street2`, `city`, `state`, `zipcode` e salva `{ us: { ship_from: { ...draft, country: 'US' } } }`. `UsShipFrom` e os padrões estão em `src/lib/shippingSettings.ts`, e `usHeadquartersReady` diz se a sede está completa.
- `DashboardPage.tsx` monta os itens de `fulfillment` com `add(us, valor, chave, texto, caminho, ação)`, como "Verificar na UPS".
- O backend (`admin-flow-fixes-6`) define as rotas, os códigos de erro e o campo `pickup` da fila.

## Goals / Non-Goals

**Goals:**

- Pedir a coleta do dia em poucos cliques, com a quantidade já sugerida.
- Nunca pedir a coleta de novo sozinho depois de um `pickup_unconfirmed`.

**Non-Goals:**

- Mostrar o preço da coleta.
- Escolher outro endereço de coleta.
- Mudar a compra de etiqueta ou o item "Aguardando coleta UPS" do Hoje.
- Validar o telefone além de 10 dígitos (a UPS valida o resto).

## Decisions

- **Componente `UpsPickupSection`** em `src/components/shipping/`, usado por `LabelQueuePage` abaixo de "Etiquetas criadas", com `id="coleta"`. Ele recebe as etiquetas `created` da fila já carregada, lê `GET /admin/shipments/pickups` por conta própria e chama `onChanged` para a página recarregar a fila depois de pedir, cancelar ou fechar.
- **Seleção.** Todas as etiquetas sem coleta começam marcadas. A quantidade acompanha o número de marcadas até o operador editar o campo; depois, fica o que ele digitou. Assim, uma caixa com duas etiquetas, ou o contrário, ainda cabe.
- **Data e janela.** A data vem como hoje em `America/New_York`, num `<input type="date">`; o backend decide se o dia aceita coleta, e o painel só mostra o texto da recusa. A janela começa em 14:00–18:00, num `<input type="time">`, e a recusa `pickup_window_invalid` explica o problema.
- **Confirmação.** `window.confirm`, como a compra, com os dois números, porque caixas e etiquetas podem diferir: "Pedir coleta à UPS para dd/mm, das HH:MM às HH:MM, com 14 caixas (15 etiquetas)?".
- **Mesmo recorte do Hoje.** A seção lista só etiquetas sem coleta e sem leitura de rastreio (`shipment.in_transit_at` e `out_for_delivery_at` vazios), a mesma condição da contagem do Hoje e da reserva no backend.
- **Coleta `pending`.** Um pedido em andamento aparece como "Pedindo à UPS", sem ações. O backend mostra como `unknown` uma reserva parada há mais de 5 minutos, que ganha "Não foi criada".
- **Textos de erro.** Em `upsLabels.ts`, `pickupErrorText(code)`, no mesmo formato de `upsErrorText`. `pickup_ship_from_incomplete` mostra um link para `/config/shipping` (a rota de `ShippingPage`).
- **Linha da etiqueta criada.** `pickupLabel(pickup)` em `upsLabels.ts` devolve o texto da spec; a data sai em `dd/mm` sem fuso, a partir do `YYYY-MM-DD`.
- **Lista de coletas.** Sem filtro de data no painel: o padrão do backend (os últimos 7 dias) basta.
- **Telefone.** `phone` em `UsShipFrom` (vazio nos padrões), um `<Field label="Telefone">` no cartão e a dica "A UPS pede o telefone para buscar as caixas." Preenchido com menos de 10 dígitos, o campo mostra o erro e "Salvar sede" fica desabilitado, a mesma regra do backend. A recusa `pickup_ship_from_incomplete` com `missing` só `phone` fala do telefone. `usHeadquartersReady` não muda, porque o telefone só é exigido na coleta.
- **Hoje.** `upsLabelsWithoutPickup?: number` no tipo de `fulfillment` em `src/lib/today.ts`, e um `add(us, …, 'ups-without-pickup', …, '/operations/labels#coleta', 'Pedir coleta')` depois de "Verificar na UPS".

## Risks / Trade-offs

- [Backend antigo sem `pickup` na fila] → `pickup` ausente é tratado como `null`, e a seção mostra "Sem coleta" e oferece o pedido; a API recusa se a rota não existir. Os dois lados entram juntos no QA.
- [Operador muda a seleção depois de editar a quantidade] → a quantidade fica a digitada; a confirmação mostra o número de caixas e de etiquetas.

## Migration Plan

1. Entrar depois do backend do lote 6, com `npm run contract:sync`.
2. Cadastrar o telefone da sede dos EUA em Configurações > Frete no QA.
3. Reverter: esconder a seção; nada no painel depende dela.
