# Proposal

## Why

No detalhe do produto a variação já é editável, mas só como inputs na própria linha, sem um botão Editar ao lado de Excluir. O QA não acha a edição. O que grava a linha é o Salvar do produto, que manda país, dias e todas as variações juntos.

## What Changes

- Cada variação em rascunho ganha **Editar** ao lado de **Excluir**. A tabela deixa de ser formulário e passa a mostrar texto.
- **Editar** e **Adicionar variação** abrem o diálogo já usado em acessos (SKU, nome, sabor, slug, aliases, preço). Confirmar grava só aquela variação. Cancelar descarta o que foi digitado no diálogo.
- O PATCH da variação é `{ variants: [um item] }`, sem país e sem dias. Com `id`, atualiza; sem `id`, cria. Falha de rede ou 422 deixa o diálogo aberto, com os campos intactos e a mensagem dentro dele.
- Salvar do produto passa a mandar só país e duração. Publicar manda esses campos e `active: true`, sem `variants`: o preço já foi gravado no diálogo. Se país ou duração diferem do produto carregado, a seção avisa para salvar antes de sair, e fechar a aba também avisa.
- Edição de várias variações de uma vez sai de propósito. Uma confirmação, uma variação.
- **BREAKING** para o cenário de publish do painel: o body deixa de incluir `variants`. O contrato HTTP do backend não muda.

## Capabilities

### New Capabilities

- (nenhuma)

### Modified Capabilities

- `operations/catalog-products`: a variação do detalhe passa a ser editada por um diálogo que grava um item só. O publish do rascunho deixa de reenviar as variações. País e duração ganham aviso de alteração não salva.

## Impact

- **Painel (este repo):** `ProductDetailPage` e os testes dessa página, mais o spec E2E de catálogo que hoje preenche SKU e preço na tabela. Visual: `Dialog`, `.table-actions`, `ghost-button` e `danger-button` que o painel já usa. Sem fonte, cor ou componente novo.
- **Backend (`eden-bowls-backend`):** sem mudança de comportamento e sem change irmã. `patchProduct` já grava país só se `planCountry` vier preenchido e dias só se `planDays != null`; `saveVariants` só cria ou atualiza os itens do array. Uma tarefa neste change adiciona o Jest que trava esse PATCH parcial, no arquivo de teste que já existe. Sync com a Stripe continua por produto, dentro do `try/catch` que já engole a falha — o diálogo não mostra erro de Stripe.
- **Loja (`eden-bowls`):** sem impacto e sem tarefa. A loja não chama `/admin/catalog`. O catálogo público continua só com `post_status = publish`. Editar uma variação em rascunho não muda o que a loja lista; publicar continua sendo o mesmo `active: true` de hoje.
- A change aberta `catalog-product-delete-guard` reescreve o mesmo requisito de publish e ainda manda `variants` no body. Este change corrige essa frase no spec principal. Quem aplicar os dois precisa manter o publish sem `variants`.
