# Proposal

## Why

O QA marcou frases misturadas na tela Assinantes (`/billing`): “Ledger local Stripe”, “Health e sync de preços” e “Mapped 9/9 · completed”. O mesmo painel repete esse padrão em outras telas que o operador lê. A copy visível precisa ficar em português, sem mudar o que a API grava ou o que a loja mostra.

## What Changes

- Traduz títulos, descrições, botões, filtros, colunas e fallbacks fixos do frontend que o operador lê, em três fatias: Assinantes, operação/cliente, catálogo/frete/cupons.
- Status de assinatura e de job de sync passam a usar rótulos em português. Os valores enviados à API (`active`, `queued`, `sub_`, `cus_`, `promo_`) permanecem.
- Cupons: rótulos e a mensagem “Slots sincronizados” podem ir para português. A célula de prazo (`1 mês` / `<n> meses`), os alertas compactos (`6m`) e o placeholder `First purchase …` permanecem.
- O JSON técnico de recorrência não pode se chamar **Recorrência**, para não voltar a parecer a escolha de prazo do cliente.
- Não é **BREAKING**. Nenhum body, query param, status code ou campo persistido muda.

## Capabilities

### New Capabilities

- `operations/admin-panel-copy`: copy em português do que o operador lê no painel, e o que permanece em inglês (tokens, papéis, mercado US do simulador, termos de privacidade, mensagens da API).

### Modified Capabilities

- `operations/billing-coupons`: a exigência de que os rótulos da página de cupons permaneçam como estão deixa de valer para Code, Name, Duration e textos equivalentes. Célula Slot, alertas `6m` e o placeholder do nome na Stripe continuam.
- `operations/subscription-detail`: o texto de endereço ausente deixa de ser “Sem endereço no snapshot”. O sentido (cópia gravada, sem recalcular) permanece.

## Impact

- **Admin (`eden-bowls-admin`):** páginas e componentes de copy listados no plano, mais `format.ts`, `menu.ts` (grupo Cobrança) e os testes que afirmam o texto antigo. O botão **Sincronizar Stripe** do detalhe de produto permanece, porque o spec de catálogo exige esse rótulo.
- **Backend (`eden-bowls-backend`):** sem alteração e sem tarefa. A API continua devolvendo códigos (`active`, `completed`, `totalMapped`). O painel só troca o rótulo. Busca em `src/` e `tests/` não achou as frases da tela.
- **Loja (`eden-bowls`):** sem alteração e sem tarefa. A loja não renderiza essas telas nem lê os rótulos do painel. O nome do cupom enviado à Stripe continua o que o operador digita; o placeholder em inglês não vira valor default.
- **Sem tarefas** nos repos da loja e do backend.
