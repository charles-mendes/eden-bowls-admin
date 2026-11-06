# Proposal

## Why

Lote 2 da proposta de melhorias do painel (`docs/analise/proposta-melhorias.md`, na raiz do workspace): pôr o dado no lugar onde o operador decide. Hoje o despacho BR exige abrir três telas, a assinatura só mostra o que expedir depois de "Sincronizar faturas", o Hoje não fala de courier nem de NF-e, e o contato pelo WhatsApp não deixa rastro. O change irmão no backend (`admin-flow-fixes-2` em `eden-bowls-backend`) traz os dados e as rotas.

## What Changes

- **Verificar na UPS (PM-03).** Item de Hoje com compra UPS não confirmada (`upsLabel: 'unresolved'`) mostra "Verificar na UPS" em tom de erro e abre Etiquetas UPS na seção "Verificar na UPS", em vez de "Gerar etiqueta UPS".
- **Editar e motivo da falha no courier (PM-12).** A entrega em rota ganha "Editar", que abre o modal de despacho preenchido e salva pela edição, sem novo e-mail. "Falhou" pede um tipo (endereço não serve, cliente ausente, outro) além do texto.
- **Confirmação de pedido não pronto pela API (PM-20).** Etiquetas UPS e o detalhe da assinatura tratam o `409 ups_label_needs_confirmation`: mostram os motivos, pedem confirmação e reenviam com `confirm_not_ready`. O detalhe da assinatura, que hoje compra sem aviso, passa a pedir.
- **Fila do courier completa (PM-11).** A linha de "A despachar" e "Em rota" mostra o endereço para copiar, quem recebe, o telefone com botão copiar, as instruções (marcadas como do perfil) e os sabores e pacotes. No despacho, "Uber" continua selecionado (já é assim) e o campo do link passa a explicar que é o link de acompanhamento do app.
- **Expedir pela assinatura (PM-13).** "Envio UPS" e "Entrega Brasil" do detalhe listam os ciclos pagos vindos da API (preparo, entrega, situação da expedição), sem depender de "Sincronizar faturas". Faturas antigas e de valor zero deixam de aparecer como a expedir.
- **Registrar contato (PM-17).** "Registrar contato" no detalhe da assinatura, na linha do courier e na pendência de pagamento recusado de Hoje. Formulário curto (motivo, resultado, nota), canal WhatsApp, telefone com copiar. O último contato aparece na pendência e o histórico no detalhe. Só com `customers.contact.write`.
- **Hoje com courier, NF-e e Bling (PM-26, primeira etapa).** Pendências novas com destino filtrado: Brasil a despachar, em rota há mais de 24 h, falhas sem novo despacho, NF-e sem CPF / rejeitadas / com erro, Bling desconectado (só admin), compras UPS não confirmadas. O próximo passo de um ciclo BR pronto deixa de ser "Pronto para entregar" e segue a entrega da fatura: "Despachar", "Em rota", "Entregue" ou "Despachar de novo". "Verificar na UPS" abre a seção certa da página (âncora). "Bling desconectado" só com o Brasil em tela.

## Capabilities

### New Capabilities

- `operations/ups-labels`: compra de etiqueta pelo painel e a confirmação de pedido não pronto.
- `operations/customer-contacts`: registro e leitura dos contatos com o cliente no painel.

### Modified Capabilities

- `operations/courier-deliveries`: linha completa, edição depois do despacho, tipo da falha, Uber como padrão.
- `operations/subscription-detail`: expedição pelos ciclos pagos; contatos.
- `operations/today-overview`: Verificar na UPS, pendências de courier, NF-e e Bling, último contato, próximo passo BR.

## Impact

- `src/lib/today.ts`, `src/pages/DashboardPage.tsx`.
- `src/pages/CourierDeliveriesPage.tsx`, `src/components/shipping/CourierDelivery.tsx`.
- `src/pages/LabelQueuePage.tsx`, `src/pages/SubscriptionDetailPage.tsx`.
- Componente novo de contato (`src/components/CustomerContact.tsx`) e tipos em `src/lib/`.
- `src/test/mockAdminFetch.ts` (rotas novas), `contracts/backend-routes.json` (`npm run contract:sync` depois do backend).
