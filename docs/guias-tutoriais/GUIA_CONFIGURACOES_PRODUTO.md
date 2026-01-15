# 🎯 Guia Prático: Como Configurar Produtos com Materiais

Este guia mostra como usar o novo sistema de configurações dinâmicas de produto na prática.

## 📋 Pré-requisitos

1. **Materiais cadastrados** no sistema
2. **Produto criado** com modo `DYNAMIC_ENGINEER`
3. **APIs funcionando** (backend rodando)

## 🚀 Passo a Passo Completo

### 1️⃣ Criar um Produto Base

```bash
POST /api/catalog/products
```

```json
{
  "name": "Cardápio Encadernado",
  "description": "Cardápio personalizado com opções de encadernação",
  "pricingMode": "DYNAMIC_ENGINEER",
  "markup": 2.5
}
```

**Resposta**: `{ "id": "produto-id-123", ... }`

---

### 2️⃣ Adicionar Materiais Base ao Produto

#### Material 1: Papel Couché (páginas internas)
```bash
POST /api/catalog/products/produto-id-123/components
```

```json
{
  "materialId": "material-papel-couch-id",
  "consumptionMethod": "BOUNDING_BOX",
  "wastePercentage": 0.03,
  "priority": 1,
  "notes": "Páginas internas do cardápio"
}
```

#### Material 2: Plastificação
```bash
POST /api/catalog/products/produto-id-123/components
```

```json
{
  "materialId": "material-plastificacao-id", 
  "consumptionMethod": "LINEAR_NEST",
  "wastePercentage": 0.05,
  "priority": 2,
  "notes": "Plastificação das páginas"
}
```

---

### 3️⃣ Criar Configurações Dinâmicas

#### Configuração 1: Número de Páginas
```bash
POST /api/catalog/products/produto-id-123/configurations
```

```json
{
  "name": "Número de Páginas",
  "type": "NUMBER",
  "required": true,
  "defaultValue": "8",
  "minValue": 4,
  "maxValue": 100,
  "step": 4,
  "affectsComponents": true,
  "affectsPricing": true,
  "displayOrder": 1
}
```

#### Configuração 2: Tipo de Capa
```bash
POST /api/catalog/products/produto-id-123/configurations
```

```json
{
  "name": "Tipo de Capa",
  "type": "SELECT", 
  "required": true,
  "affectsComponents": true,
  "affectsPricing": true,
  "displayOrder": 2
}
```

**Resposta**: `{ "id": "config-capa-id", ... }`

#### Adicionar Opções para Tipo de Capa

**Opção 1: Capa Flexível**
```bash
POST /api/catalog/configurations/config-capa-id/options
```

```json
{
  "label": "Capa Flexível (Couché 300g)",
  "value": "soft_cover",
  "priceModifier": 0,
  "additionalComponents": [
    {
      "materialId": "material-papel-couch-id",
      "consumptionMethod": "BOUNDING_BOX", 
      "formula": "2"
    }
  ],
  "displayOrder": 1
}
```

**Opção 2: Capa Dura**
```bash
POST /api/catalog/configurations/config-capa-id/options
```

```json
{
  "label": "Capa Dura (Papelão + Adesivo)",
  "value": "hard_cover", 
  "priceModifier": 15.00,
  "additionalComponents": [
    {
      "materialId": "material-papelao-id",
      "consumptionMethod": "BOUNDING_BOX",
      "formula": "2"
    }
  ],
  "displayOrder": 2
}
```

#### Configuração 3: Tipo de Encadernação
```bash
POST /api/catalog/products/produto-id-123/configurations
```

```json
{
  "name": "Tipo de Encadernação",
  "type": "SELECT",
  "required": true,
  "affectsComponents": true,
  "affectsPricing": true,
  "displayOrder": 3
}
```

**Adicionar opções**: Grampo (R$ 0,00) e Wire-o (+R$ 8,00)

#### Configuração 4: Montagem de Arte
```bash
POST /api/catalog/products/produto-id-123/configurations
```

```json
{
  "name": "Montagem de Arte",
  "type": "BOOLEAN",
  "required": false,
  "defaultValue": "false",
  "affectsComponents": false,
  "affectsPricing": true,
  "displayOrder": 4
}
```

---

### 4️⃣ Testar as Configurações

#### Obter configurações completas do produto
```bash
GET /api/catalog/products/produto-id-123/configurations/complete
```

**Resposta**:
```json
{
  "success": true,
  "data": {
    "product": {
      "id": "produto-id-123",
      "name": "Cardápio Encadernado",
      "pricingMode": "DYNAMIC_ENGINEER"
    },
    "configurations": [
      {
        "id": "config-1",
        "name": "Número de Páginas",
        "type": "NUMBER",
        "required": true,
        "minValue": 4,
        "maxValue": 100,
        "step": 4,
        "options": []
      },
      {
        "id": "config-2", 
        "name": "Tipo de Capa",
        "type": "SELECT",
        "required": true,
        "options": [
          {
            "id": "opt-1",
            "label": "Capa Flexível (Couché 300g)",
            "value": "soft_cover",
            "priceModifier": 0
          },
          {
            "id": "opt-2",
            "label": "Capa Dura (Papelão + Adesivo)", 
            "value": "hard_cover",
            "priceModifier": 15.00
          }
        ]
      }
    ]
  }
}
```

#### Validar configurações selecionadas
```bash
POST /api/catalog/products/produto-id-123/configurations/validate
```

```json
{
  "selectedConfigurations": {
    "config-1": "8",
    "config-2": "hard_cover",
    "config-3": "wire_o", 
    "config-4": "true"
  }
}
```

**Resposta**:
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "errors": []
  }
}
```

---

## 🎨 Como Usar na Interface

### 1. **Página de Edição de Produto**
- Seção "Materiais" para gerenciar componentes
- Seção "Configurações" para criar configurações dinâmicas

### 2. **Ao Criar Pedido**
- Formulário dinâmico aparece baseado nas configurações
- Cálculo em tempo real de materiais e preços
- Preview dos materiais necessários

### 3. **Exemplo de Interface no Pedido**

```
┌─ Adicionar Item: Cardápio Encadernado ─────────────────────┐
│                                                            │
│ Dimensões Básicas:                                         │
│ ├─ Largura: [210] mm                                      │
│ ├─ Altura:  [297] mm                                      │
│ └─ Quantidade: [10] unidades                              │
│                                                            │
│ ┌─ Configurações do Produto ─────────────────────────────┐ │
│ │                                                        │ │
│ │ Número de Páginas: [8] páginas                        │ │
│ │                                                        │ │
│ │ Tipo de Capa:                                          │ │
│ │ ○ Flexível (Couché 300g)           R$ 0,00            │ │
│ │ ● Dura (Papelão + Adesivo)        +R$ 15,00           │ │
│ │                                                        │ │
│ │ Tipo de Encadernação:                                  │ │
│ │ ○ Simples (Grampo)                 R$ 0,00            │ │
│ │ ● Wire-o                          +R$ 8,00            │ │
│ │                                                        │ │
│ │ Montagem de Arte:                                      │ │
│ │ ☑ Incluir montagem                +R$ 25,00           │ │
│ │                                                        │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                            │
│ ┌─ Resumo Automático ─────────────────────────────────────┐ │
│ │                                                        │ │
│ │ Materiais Calculados:                                  │ │
│ │ ✓ Papel Couché 300g: 42 folhas    R$ 105,00          │ │
│ │ ✓ Plastificação: 43 folhas        R$ 382,70          │ │
│ │ ✓ Capa Dura: 21 folhas            R$ 79,80           │ │
│ │ ✓ Wire-o: 10 espirais             R$ 12,00           │ │
│ │                                                        │ │
│ │ Custos Adicionais:                                     │ │
│ │ ✓ Capa Dura: +R$ 150,00 (10 × R$ 15,00)             │ │
│ │ ✓ Wire-o: +R$ 80,00 (10 × R$ 8,00)                  │ │
│ │ ✓ Montagem Arte: +R$ 250,00 (10 × R$ 25,00)         │ │
│ │                                                        │ │
│ │ ────────────────────────────────────────────────────── │ │
│ │ TOTAL: R$ 1.059,50                                    │ │
│ │ Por unidade: R$ 105,95                                │ │
│ │                                                        │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                            │
│ [Cancelar] [Adicionar ao Pedido]                         │
└────────────────────────────────────────────────────────────┘
```

---

## 🔧 Comandos Úteis para Testar

### Listar todos os produtos
```bash
GET /api/catalog/products
```

### Listar materiais disponíveis  
```bash
GET /api/catalog/materials
```

### Ver componentes de um produto
```bash
GET /api/catalog/products/{id}/components
```

### Validar configuração de produto
```bash
GET /api/catalog/products/{id}/validate
```

---

## 💡 Dicas Importantes

1. **Ordem das Configurações**: Use `displayOrder` para controlar a ordem na interface
2. **Materiais Obrigatórios**: Produtos DYNAMIC_ENGINEER precisam de pelo menos 1 material
3. **Compatibilidade**: BOUNDING_BOX só funciona com SHEET, LINEAR_NEST só com ROLL
4. **Percentuais de Perda**: Serão calculados automaticamente conforme o uso
5. **Modificadores de Preço**: Podem ser positivos (+R$ 15,00) ou negativos (-R$ 5,00)

---

## 🎯 Próximos Passos

1. **Implementar Frontend**: Criar interfaces para gerenciar essas configurações
2. **MaterialCalculator Real**: Integrar com o sistema de componentes
3. **Sistema de Perdas**: Registrar perdas reais na produção
4. **Relatórios**: Analisar consumo e desperdício por produto

---

**🚀 Agora você pode criar produtos totalmente configuráveis!**

Cada produto pode ter infinitas variações sem precisar criar produtos separados. O cliente escolhe as opções e o sistema calcula automaticamente os materiais e preços necessários.