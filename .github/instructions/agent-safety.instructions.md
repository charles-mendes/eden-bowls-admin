---
applyTo: "**/*"
description: "Use when making any change that may require retries, dependency changes, architecture changes, database changes, or autonomous correction."
---

# Limites de execução e autonomia

O agente deve trabalhar de forma autônoma dentro de limites controlados.

## Correções

- Para cada falha, faça no máximo 3 ciclos de análise, correção e reexecução.
- Depois de três falhas sem solução identificável, pare e informe erro, causa provável, arquivos alterados, tentativas, testes e ação necessária.
- Não entre em loop de corrigir -> testar -> corrigir -> testar.
- Não altere mais de 10 arquivos em uma alteração normal sem justificativa clara.
- Não faça refatorações, mudanças de nomenclatura ou melhorias fora do escopo.

## Dependências e arquitetura

Antes de adicionar dependência, verifique bibliotecas existentes, possibilidade de usar recursos atuais e impacto da mudança. Informe a necessidade antes de uma alteração importante.

Não faça automaticamente migração de framework, troca de biblioteca, mudança de autenticação, infraestrutura, CI/CD ou configuração de produção. Essas mudanças são tarefas separadas, salvo necessidade indispensável para corrigir o problema atual.

## Banco de dados

Não execute alterações destrutivas ou estruturais automaticamente, incluindo `DROP`, `TRUNCATE`, `ALTER TABLE`, deleções massivas ou migrations destrutivas. Se forem necessárias, documente a mudança, valide o impacto e solicite aprovação quando apropriado.

## Parada obrigatória

Pare e solicite intervenção quando houver mais de três tentativas, mudança arquitetural relevante, alteração destrutiva no banco, nova infraestrutura, comportamento ambíguo, conflito entre requisitos, falhas sem causa identificável, risco de produção, necessidade de credenciais ou escopo significativamente maior.
