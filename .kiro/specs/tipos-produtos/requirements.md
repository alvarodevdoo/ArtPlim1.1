# Requirements Document - Tipos de Produtos

## Introduction

Este documento especifica os requisitos para implementar a funcionalidade de "Tipos de Produtos" no ArtPlimERP, permitindo diferenciar entre Serviços (Design), Impressão (Folha/Rolo) e Corte a Laser, com suporte a medidas e atributos variáveis.

## Glossary

- **ItemType**: Enum que define os tipos de produtos disponíveis no sistema
- **OrderItem**: Item de pedido que pode ter diferentes tipos e atributos
- **QuoteItem**: Item de orçamento com as mesmas características de OrderItem
- **StandardSize**: Tamanhos padrão configuráveis por tipo de produto
- **ProductionMaterial**: Materiais específicos para cada tipo de produção
- **Finish**: Acabamentos aplicáveis a diferentes tipos de produtos
- **Attributes**: Objeto JSON que armazena dados específicos por tipo de produto

## Requirements

### Requirement 1: Enum de Tipos de Produto

**User Story:** Como administrador do sistema, eu quero definir tipos de produtos, para que eu possa categorizar diferentes tipos de trabalhos gráficos.

#### Acceptance Criteria

1. THE System SHALL support an ItemType enum with values: PRODUCT, SERVICE, PRINT_SHEET, PRINT_ROLL, LASER_CUT
2. WHEN creating or editing items, THE System SHALL allow selection of item type
3. THE System SHALL use PRODUCT as the default item type for backward compatibility
4. THE System SHALL validate that only valid ItemType values are accepted

### Requirement 2: Atualização de Itens de Pedido e Orçamento

**User Story:** Como vendedor, eu quero adicionar informações específicas por tipo de produto nos itens, para que eu possa capturar todos os dados necessários para produção.

#### Acceptance Criteria

1. WHEN adding an item to an order, THE System SHALL include itemType field with ItemType enum
2. WHEN the item type requires dimensions, THE System SHALL capture width and height as Decimal values
3. WHEN dimensions are provided, THE System SHALL optionally calculate and store totalArea
4. THE System SHALL store type-specific data in an attributes JSON field
5. WHEN saving item data, THE System SHALL validate attributes structure based on item type

### Requirement 3: Tamanhos Padrão por Tipo

**User Story:** Como usuário do sistema, eu quero selecionar tamanhos padrão baseados no tipo de produto, para que eu possa agilizar o processo de criação de itens.

#### Acceptance Criteria

1. THE System SHALL provide a StandardSize table with fields: id, name, width, height, type, companyId
2. WHEN selecting item type, THE System SHALL filter available standard sizes by type
3. WHEN a standard size is selected, THE System SHALL automatically populate width and height fields
4. THE System SHALL allow creation of custom standard sizes per company
5. THE System SHALL support standard sizes for PRINT_SHEET, PRINT_ROLL, and LASER_CUT types

### Requirement 4: Materiais de Produção

**User Story:** Como operador de produção, eu quero ter materiais específicos por tipo de produto, para que eu possa selecionar os materiais corretos durante o processo.

#### Acceptance Criteria

1. THE System SHALL provide a ProductionMaterial table with fields: id, name, type, costPrice, salesPrice, properties, companyId
2. WHEN selecting materials, THE System SHALL filter by item type
3. THE System SHALL store material properties as JSON for flexibility (thickness, weight, etc.)
4. THE System SHALL support cost and sales price tracking per material
5. THE System SHALL associate materials with specific ItemType values

### Requirement 5: Acabamentos Filtrados por Tipo

**User Story:** Como vendedor, eu quero ver apenas acabamentos aplicáveis ao tipo de produto selecionado, para que eu não ofereça acabamentos incompatíveis.

#### Acceptance Criteria

1. WHEN updating Finish table, THE System SHALL add allowedTypes field as ItemType array
2. WHEN selecting finishes, THE System SHALL filter options based on current item type
3. THE System SHALL prevent selection of incompatible finishes for each type
4. THE System SHALL maintain existing finish data for backward compatibility
5. WHEN no allowedTypes is specified, THE System SHALL show finish for all types

### Requirement 6: Formulário Dinâmico por Tipo

**User Story:** Como vendedor, eu quero um formulário que se adapte ao tipo de produto selecionado, para que eu veja apenas os campos relevantes para cada tipo.

#### Acceptance Criteria

1. WHEN SERVICE type is selected, THE System SHALL show only quantity, description and value fields
2. WHEN LASER_CUT or PRINT_ROLL types are selected, THE System SHALL show width, height, material and finishing fields
3. WHEN PRINT_SHEET type is selected, THE System SHALL show standard size dropdown and auto-populate dimensions
4. THE System SHALL calculate totalArea automatically for dimensional products
5. WHEN form is submitted, THE System SHALL pack type-specific data into attributes JSON

### Requirement 7: Validação de Dados por Tipo

**User Story:** Como sistema, eu quero validar dados baseados no tipo de produto, para que eu garanta consistência e integridade dos dados.

#### Acceptance Criteria

1. WHEN SERVICE type is used, THE System SHALL not require width and height fields
2. WHEN dimensional types are used, THE System SHALL require width and height values greater than zero
3. THE System SHALL validate attributes JSON structure based on item type
4. WHEN saving items, THE System SHALL ensure required fields per type are provided
5. THE System SHALL prevent invalid combinations of type and attributes

### Requirement 8: Compatibilidade com Sistema Existente

**User Story:** Como administrador, eu quero que a nova funcionalidade seja compatível com dados existentes, para que eu não perca informações já cadastradas.

#### Acceptance Criteria

1. THE System SHALL maintain all existing Company, User, Partner and Financial structures intact
2. WHEN migrating existing data, THE System SHALL set itemType as PRODUCT for all existing items
3. THE System SHALL preserve all existing OrderItem and QuoteItem data
4. THE System SHALL allow gradual adoption of new types without breaking existing functionality
5. THE System SHALL provide migration scripts for data conversion if needed

### Requirement 9: Cálculo Automático de Área

**User Story:** Como vendedor, eu quero que o sistema calcule automaticamente a área total, para que eu tenha informações precisas para precificação.

#### Acceptance Criteria

1. WHEN width and height are provided, THE System SHALL calculate area in square meters
2. WHEN quantity is specified, THE System SHALL calculate total area (area × quantity)
3. THE System SHALL update area calculations automatically when dimensions change
4. THE System SHALL display area information in user-friendly format
5. THE System SHALL use area calculations for pricing when applicable

### Requirement 10: Armazenamento de Atributos Específicos

**User Story:** Como desenvolvedor, eu quero armazenar dados específicos por tipo de forma flexível, para que eu possa adicionar novos campos sem alterar o schema.

#### Acceptance Criteria

1. THE System SHALL store SERVICE attributes like description and briefing in JSON
2. THE System SHALL store LASER_CUT attributes like material, machineTime and vectorFile in JSON
3. THE System SHALL store PRINT_ROLL attributes like material and finish array in JSON
4. THE System SHALL validate JSON structure based on predefined schemas per type
5. THE System SHALL allow querying and filtering based on attributes content