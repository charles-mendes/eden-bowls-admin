# Perfil de usuario — instrucoes de entrega

## Nome da funcionalidade

Delivery Instructions no perfil WordPress.

Nao e menu. Aparece em **Usuarios → Perfil** (proprio) e **Usuarios → editar usuario**.

Codigo: `ProfileApi::render_admin_delivery_instructions_field` / `save_admin_delivery_instructions_field`.

## Objetivo

Permitir que operacao leia e altere as instrucoes de entrega do cliente (portaria, pet, local de deixa), o mesmo campo exposto no app via `PUT /custom/v1/profile/delivery`.

Atores: quem pode `edit_user` daquele usuario (admin, e o proprio usuario se tiver acesso ao perfil WP — o que colaboradores podem ter via `list_users`).

## Pre-condicoes

- Usuario alvo existe.
- Save so ocorre com nonce valido e `current_user_can('edit_user', $userId)`.

## Fluxo

1. Tela de perfil mostra heading "Delivery Instructions" + textarea.
2. Ao salvar o perfil WP, se nonce `hsr_delivery_instructions` ok, grava user meta `_eden_delivery_instructions` (sanitize_textarea_field).
3. Se nonce ausente/invalido: **silencio** (nao grava, nao notice). **[REGRA CONFIRMADA]**

Nao ha validacao de tamanho/conteudo alem do sanitize WP.

## CRUD

- Read/Update deste campo.
- Delete = salvar vazio (nao ha botao exclusivo).

## Campos

| Campo | Tipo | Obrigatorio | Meta |
|---|---|---|---|
| hsr_delivery_instructions | textarea | nao | `_eden_delivery_instructions` |

Descricao UI: "Special instructions for delivery drivers, gate code, preferred drop-off location, or pet safety notes."

## APIs

A tela nao chama REST. O app usa as rotas `/custom/v1/profile*`. Mesmo meta.

## Permissoes

`edit_user`. Nonce `hsr_delivery_instructions`.

## Observacoes para migracao

- Campo de Cliente, nao de "usuario WP".
- Operador deve poder editar no detalhe do cliente; o cliente edita no app.
- Sem regra de negocio extra alem de persistir texto livre sanitizado.
