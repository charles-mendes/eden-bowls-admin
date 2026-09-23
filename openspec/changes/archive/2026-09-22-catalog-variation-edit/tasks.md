# Tasks

Loja (`eden-bowls`): sem tarefa e sem arquivo. Ela não chama `/admin/catalog`, e o catálogo público continua só com produto publicado.

Backend (`eden-bowls-backend`): sem mudança de serviço. A única tarefa lá é o teste que trava o PATCH parcial que o painel passa a mandar.

## 1. Trava do PATCH parcial

- [x] 1.1 Em `eden-bowls-backend/tests/admin-catalog.service.test.js`, adicionar um caso em que `patchProduct` recebe só `{ variants: [uma variação existente] }` num produto que já tem país, dias e outra variação. Verificar que `upsertPostMeta` não é chamado para `_cmpb_plan_country` nem `_cmpb_plan_days`, que `updateVariation` roda só para o id enviado, e que a variação irmã não entra em `updateVariation` nem em `createVariation`. Rodar só esse arquivo com Jest.

## 2. Diálogo da variação

- [x] 2.1 Em `ProductDetailPage`, mostrar a variação como texto e, no rascunho com `catalog.write`, colocar **Editar** (`ghost-button`) ao lado de **Excluir** (`danger-button`) em `.table-actions`. **Adicionar variação** e **Editar** abrem o `Dialog` já usado em acessos, com SKU, nome, sabor, slug, aliases e preço. Slug travado quando a variação já tem id e slug. Publicado e somente leitura não veem **Editar** nem **Adicionar variação**. Verificar no Vitest do detalhe: rascunho mostra os dois botões, publicado e readonly não mostram **Editar**.

- [x] 2.2 Confirmar o diálogo manda `PATCH` com `{ variants: [um item] }` e sem `planCountry` e `planDays`. Item existente leva `id`; item novo não leva. Nome e SKU vazios numa variação nova não disparam request e o diálogo continua aberto. Cancelar não dispara request. Falha do PATCH mantém o diálogo aberto, os campos digitados e a mensagem dentro dele. Sucesso fecha o diálogo e atualiza a tabela. Verificar esses quatro casos no Vitest do detalhe.

## 3. Salvar e publicar o produto

- [x] 3.1 **Salvar** manda só país e duração. **Publicar** manda país, duração e `active: true`, sem `variants`. Quando país ou duração diferem do produto carregado, mostrar "País e duração alterados. Salve antes de sair." e registrar `beforeunload`. Salvar ou recarregar o produto tira o aviso. Verificar no Vitest que o body do Salvar e o do Publicar não têm `variants`, e que o aviso aparece ao mudar a duração.

## 4. Verificação

- [x] 4.1 Atualizar `e2e/specs/admin-catalog.spec.ts` nos fluxos que hoje preenchem SKU ou preço na tabela: editar pelo diálogo e publicar sem `variants` no body. Rodar só esse spec. Rodar o Vitest relacionado de `ProductDetailPage.tsx`.
