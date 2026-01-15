'# Implementation Plan: Tipos de Produtos

## Overview

Este plano implementa a funcionalidade de "Tipos de Produtos" no ArtPlimERP através de uma abordagem incremental, começando pelo backend (schema e APIs), seguido pelo frontend (formulário dinâmico) e finalizando com testes e migração de dados.

## Tasks

- [x] 1. Atualizar Schema do Banco de Dados ✅ **COMPLETED**
  - ✅ Adicionar enum ItemType ao schema Prisma
  - ✅ Atualizar tabelas OrderItem e QuoteItem com novos campos
  - ✅ Criar tabela StandardSize para tamanhos padrão
  - ✅ Criar tabela ProductionMaterial para materiais de produção
  - ✅ Atualizar tabela Finish com campo allowedTypes
  - ✅ Aplicar migração no banco de dados
  - ✅ Gerar Prisma Client atualizado
  - _Requirements: 1.1, 2.1, 2.2, 3.1, 4.1, 5.1_

- [x] 1.1 Escrever teste de propriedade para validação do enum ItemType ✅ **COMPLETED**
  - **Property 1: ItemType Enum Validation**
  - **Validates: Requirements 1.1, 1.4**

- [x] 1.2 Escrever teste de propriedade para valor padrão do ItemType ✅ **COMPLETED**
  - **Property 2: Default ItemType Assignment**
  - **Validates: Requirements 1.3**

- [x] 2. Implementar Validação Backend por Tipo
  - [x] 2.1 Criar serviço de validação ItemValidationService
    - Implementar schemas de validação por tipo de produto
    - Validar campos obrigatórios baseados no ItemType
    - Validar estrutura JSON dos atributos por tipo
    - _Requirements: 2.4, 2.5, 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 2.2 Escrever teste de propriedade para validação dimensional
    - **Property 3: Dimensional Field Requirements**
    - **Validates: Requirements 2.2, 7.2**

  - [x] 2.3 Escrever teste de propriedade para isenção de dimensões em SERVICE
    - **Property 4: Service Type Dimension Exemption**
    - **Validates: Requirements 7.1**

  - [x] 2.4 Escrever teste de propriedade para validação de atributos JSON
    - **Property 7: Attributes JSON Structure Validation**
    - **Validates: Requirements 2.4, 2.5, 10.4**

- [x] 3. Implementar Cálculos Automáticos
  - [x] 3.1 Criar função de cálculo de área
    - Calcular área em m² a partir de largura e altura em mm
    - Calcular área total multiplicando por quantidade
    - Atualizar área automaticamente quando dimensões mudam
    - _Requirements: 2.3, 9.1, 9.2, 9.3_

  - [x] 3.2 Escrever teste de propriedade para cálculo de área
    - **Property 5: Area Calculation Accuracy**
    - **Validates: Requirements 2.3, 9.1**

  - [x] 3.3 Escrever teste de propriedade para área total
    - **Property 6: Total Area Calculation**
    - **Validates: Requirements 9.2**

- [x] 4. Implementar APIs para Dados Auxiliares ✅ **COMPLETED**
  - [x] 4.1 Criar endpoints para StandardSize
    - GET /api/standard-sizes?type={ItemType} - listar por tipo
    - POST /api/standard-sizes - criar novo tamanho padrão
    - PUT /api/standard-sizes/:id - atualizar tamanho
    - DELETE /api/standard-sizes/:id - remover tamanho
    - _Requirements: 3.1, 3.2, 3.4_

  - [x] 4.2 Escrever teste de propriedade para filtragem de tamanhos padrão
    - **Property 8: Standard Size Filtering**
    - **Validates: Requirements 3.2**

  - [x] 4.3 Criar endpoints para ProductionMaterial
    - GET /api/production-materials?type={ItemType} - listar por tipo
    - POST /api/production-materials - criar novo material
    - PUT /api/production-materials/:id - atualizar material
    - DELETE /api/production-materials/:id - remover material
    - _Requirements: 4.1, 4.2, 4.4, 4.5_

  - [x] 4.4 Escrever teste de propriedade para filtragem de materiais
    - **Property 10: Material Type Filtering**
    - **Validates: Requirements 4.2**

  - [x] 4.5 Atualizar endpoints de Finish para filtragem por tipo ✅ **COMPLETED**
    - Modificar GET /api/finishes para aceitar parâmetro type
    - Implementar lógica de filtragem baseada em allowedTypes
    - Manter compatibilidade com finishes sem allowedTypes
    - _Requirements: 5.2, 5.3, 5.4, 5.5_

  - [x] 4.6 Escrever teste de propriedade para compatibilidade de acabamentos ✅ **COMPLETED**
    - **Property 11: Finish Type Compatibility**
    - **Validates: Requirements 5.2, 5.3**

  - [x] 4.7 Escrever teste de propriedade para compatibilidade retroativa de acabamentos ✅ **COMPLETED**
    - **Property 12: Finish Backward Compatibility**
    - **Validates: Requirements 5.5**

- [x] 5. Checkpoint - Validar APIs Backend ✅ **COMPLETED**
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Refatorar Componente AddItemForm
  - [x] 6.1 Adicionar seletor de ItemType ✅ **COMPLETED**
    - Criar dropdown/radio para seleção do tipo de produto
    - Implementar mudança dinâmica de campos baseada no tipo
    - Definir PRODUCT como valor padrão
    - _Requirements: 1.2, 1.3, 6.1, 6.2, 6.3_

  - [x] 6.2 Escrever teste de propriedade para visibilidade de campos por tipo ✅ **COMPLETED**
    - **Property 13: Form Field Visibility by Type**
    - **Validates: Requirements 6.1, 6.2, 6.3**

  - [x] 6.3 Implementar campos específicos por tipo
    - ServiceFields: description, briefing, estimatedHours
    - PrintSheetFields: paperSize, paperType, printColors, finishing
    - PrintRollFields: material, finishes array, installationType
    - LaserCutFields: material, machineTime, vectorFile, cutType
    - _Requirements: 6.1, 6.2, 6.3, 10.1, 10.2, 10.3_

  - [x] 6.4 Implementar auto-população de dimensões
    - Conectar seleção de StandardSize com campos width/height
    - Implementar cálculo automático de área no frontend
    - Atualizar área quando dimensões ou quantidade mudam
    - _Requirements: 3.3, 6.4, 9.3, 9.4_

  - [x] 6.5 Escrever teste de propriedade para auto-população de tamanhos
    - **Property 9: Standard Size Auto-Population**
    - **Validates: Requirements 3.3**

  - [x] 6.6 Implementar empacotamento de dados em JSON
    - Coletar dados específicos por tipo do formulário
    - Empacotar em estrutura JSON para campo attributes
    - Validar estrutura antes do envio
    - _Requirements: 6.5, 10.1, 10.2, 10.3_

  - [x] 6.7 Escrever teste de propriedade para empacotamento de atributos
    - **Property 14: Attributes Data Packing**
    - **Validates: Requirements 6.5**

- [x] 7. Atualizar Componente de Exibição de Itens ✅ **COMPLETED**
  - [x] 7.1 Modificar renderização de itens no CriarPedido.tsx ✅ **COMPLETED**
    - Exibir tipo de produto de forma visual
    - Mostrar campos específicos baseados no tipo
    - Adaptar cálculos de área e preço por tipo
    - Manter compatibilidade com itens existentes
    - _Requirements: 8.4, 9.4, 9.5_

  - [x] 7.2 Criar componentes de exibição por tipo ✅ **COMPLETED**
    - ServiceItemDisplay: mostrar descrição e briefing
    - PrintItemDisplay: mostrar especificações de impressão
    - LaserItemDisplay: mostrar material e tempo de máquina
    - ProductItemDisplay: exibição padrão para produtos
    - _Requirements: 6.1, 6.2, 6.3, 9.4_

- [x] 8. Implementar Hooks e Serviços Frontend ✅ **COMPLETED**
  - [x] 8.1 Criar hook useStandardSizes ✅ **COMPLETED**
    - Carregar tamanhos padrão filtrados por tipo
    - Implementar cache e invalidação
    - Tratar estados de loading e erro
    - _Requirements: 3.2, 3.4_

  - [x] 8.2 Criar hook useProductionMaterials ✅ **COMPLETED**
    - Carregar materiais filtrados por tipo
    - Implementar busca e filtragem
    - Gerenciar estado de seleção
    - _Requirements: 4.2, 4.5_

  - [x] 8.3 Criar hook useFinishesByType ✅ **COMPLETED**
    - Carregar acabamentos compatíveis com tipo
    - Implementar filtragem baseada em allowedTypes
    - Manter compatibilidade retroativa
    - _Requirements: 5.2, 5.3, 5.5_

- [x] 9. Implementar Migração de Dados ✅ **COMPLETED**
  - [x] 9.1 Criar script de migração Prisma ✅ **COMPLETED**
    - Adicionar colunas com valores padrão
    - Migrar dados existentes para itemType PRODUCT
    - Preservar integridade referencial
    - Criar índices para performance
    - _Requirements: 8.1, 8.2, 8.3, 8.5_

  - [x] 9.2 Escrever teste de propriedade para integridade da migração ✅ **COMPLETED**
    - **Property 15: Data Migration Integrity**
    - **Property 28: Migration Referential Integrity**
    - **Property 29: Migration Performance Constraints**
    - **Property 30: Migration Rollback Safety**
    - **Property 31: Migration Data Type Consistency**
    - **Property 32: Migration Index Creation**
    - **Validates: Requirements 8.2, 8.3**

  - [x] 9.3 Criar dados de exemplo para StandardSize e ProductionMaterial ✅ **COMPLETED**
    - Tamanhos padrão: A4, A3, Cartão de Visita, etc.
    - Materiais: MDF, Lona, Couché, Sulfite, etc.
    - Acabamentos com allowedTypes configurados
    - _Requirements: 3.1, 4.1, 5.1_

- [x] 10. Implementar Testes de Armazenamento de Atributos ✅ **COMPLETED**
  - [x] 10.1 Escrever teste de propriedade para atributos SERVICE ✅ **COMPLETED**
    - **Property 16: Type-Specific Attribute Storage (SERVICE)**
    - **Validates: Requirements 10.1**

  - [x] 10.2 Escrever teste de propriedade para atributos LASER_CUT ✅ **COMPLETED**
    - **Property 16: Type-Specific Attribute Storage (LASER_CUT)**
    - **Validates: Requirements 10.2**

  - [x] 10.3 Escrever teste de propriedade para atributos PRINT_ROLL ✅ **COMPLETED**
    - **Property 16: Type-Specific Attribute Storage (PRINT_ROLL)**
    - **Validates: Requirements 10.3**

  - [x] 10.4 Escrever teste de propriedade para consulta de atributos JSON ✅ **COMPLETED**
    - **Property 17: JSON Attribute Querying**
    - **Property 33: Cross-Type Attribute Isolation**
    - **Property 34: Attribute Schema Evolution**
    - **Validates: Requirements 10.5**

- [x] 11. Testes de Integração e Validação Final ✅ **COMPLETED**
  - [x] 11.1 Escrever testes de integração para fluxo completo ✅ **COMPLETED**
    - Testar criação de itens de cada tipo
    - Validar persistência e recuperação de dados
    - Verificar cálculos e validações end-to-end
    - **Property 35: End-to-End Item Creation Workflow**
    - **Property 36: Item Update and Modification Workflow**
    - **Property 37: Cross-Type Validation Consistency**
    - **Property 38: Data Persistence and Retrieval Integrity**
    - **Property 39: Pricing and Calculation Accuracy**
    - _Requirements: All_

  - [x] 11.2 Escrever testes de compatibilidade retroativa ✅ **COMPLETED**
    - Testar funcionamento com dados existentes
    - Validar que funcionalidades antigas continuam funcionando
    - Verificar migração de dados
    - **Property 40: Legacy Data Migration Integrity**
    - **Property 41: Legacy System Compatibility**
    - **Property 42: Feature Degradation Gracefully**
    - **Property 43: Data Integrity During Migration**
    - **Property 44: Performance Consistency**
    - _Requirements: 8.1, 8.4_

- [x] 12. Checkpoint Final - Validação Completa
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks are comprehensive and include all testing for production-ready implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Migration should be tested thoroughly before production deployment
- Frontend changes should maintain backward compatibility with existing data