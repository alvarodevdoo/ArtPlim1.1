---
name: ArtPlimDevelopmentStandards
description: Regras obrigatórias de arquitetura (SOLID, Package by Feature e Componentização) para o ERP.
---

# ArtPlim Development Standards

Este guia deve ser seguido por todo agente de IA que atuar neste repositório.

## Regras de Ouro:
1. **SOLID Obrigatório:** Componentes com única responsabilidade, injeção de dependência via hooks/props.
2. **Package by Feature:** Código organizado por domínio de negócio (ex: `src/features/organization/backup`).
3. **Componentização:** Proibido "God Components". Divida em sub-componentes especializados.
4. **Clean Code:** Nomes descritivos e código modular.

## Quando Usar:
- Antes de implementar QUALQUER nova funcionalidade.
- Antes de refatorar código existente.
- Antes de realizar correções que afetem a estrutura de pastas.

## Referência:
Consulte sempre o arquivo original em [DEVELOPMENT_STANDARDS.md](file:///d:/www/NArtPlim/DEVELOPMENT_STANDARDS.md).
