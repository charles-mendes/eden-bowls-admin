---
name: ast-grep
description: Search TypeScript/TSX by AST structure with the local ast-grep CLI. Use when locating call sites, hooks, JSX usage, or code patterns more precisely than text search with rg.
---

# ast-grep

`ast-grep` already works locally. Do not install it. Prefer it over `rg` when the query is a code pattern, not a word.

## Commands

```bash
ast-grep -p '<padrão>' -l ts src
ast-grep -p '<padrão>' -l tsx src
```

- `$A` matches one AST node
- `$$$` matches zero or more nodes (arguments, statements, JSX children)

## Examples

```bash
ast-grep -p 'apiRequest($$$)' -l ts src
ast-grep -p 'hasPermission($PERM)' -l tsx src
ast-grep -p 'await $OBJ.$METHOD($$$)' -l ts src
ast-grep -p '<RequireAuth $$$>' -l tsx src
```

Read a file only after `ast-grep` (or `rg`/`fd`) points to it. Do not open many files to discover how a pattern is used.
