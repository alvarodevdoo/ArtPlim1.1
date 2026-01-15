# 🎯 Exemplo Prático: Configurando "Cardápio Encadernado"

Vou te mostrar **passo a passo** como configurar um produto real usando as APIs que acabei de criar.

## 🚀 Cenário Real

Você quer criar um produto **"Cardápio Encadernado"** que o cliente pode personalizar:
- **Número de páginas** (4, 8, 12, 16...)
- **Tipo de capa** (Flexível ou Dura)
- **Encadernação** (Grampo ou Wire-o)
- **Montagem de arte** (Sim/Não)

## 📋 Pré-requisitos

Você precisa ter estes materiais cadastrados no sistema:
1. **Papel Couché 300g** (para páginas)
2. **Plastificação Brilho** (para acabamento)
3. **Papelão + Adesivo** (para capa dura)
4. **Grampo 26/6** (para encadernação simples)
5. **Espiral Wire-o** (para encadernação wire-o)

## 🎯 Passo 1: Criar o Produto Base

```bash
curl -X POST http://localhost:3001/api/catalog/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{
    "name": "Cardápio Encadernado",
    "description": "Cardápio personalizado com opções de encadernação e acabamento",
    "pricingMode": "DYNAMIC_ENGINEER",
    "markup": 2.5
  }'
```

**Resposta esperada:**
```json
{
  "success": true,
  "data": {
    "id": "clr123abc456def789",
    "name": "Cardápio Encadernado",
    "pricingMode": "DYNAMIC_ENGINEER",
    "markup": 2.5
  }
}
```

**💾 Anote o ID do produto:** `clr123abc456def789`

---

## 🎯 Passo 2: Adicionar Materiais Base

### Material 1: Papel Couché (páginas internas)
```bash
curl -X POST http://localhost:3001/api/catalog/products/clr123abc456def789/components \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{
    "materialId": "ID_DO_PAPEL_COUCH",
    "consumptionMethod": "BOUNDING_BOX",
    "wastePercentage": 0.03,
    "priority": 1,
    "notes": "Páginas internas do cardápio - frente e verso"
  }'
```

### Material 2: Plastificação
```bash
curl -X POST http://localhost:3001/api/catalog/products/clr123abc456def789/components \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{
    "materialId": "ID_DA_PLASTIFICACAO",
    "consumptionMethod": "LINEAR_NEST",
    "wastePercentage": 0.05,
    "priority": 2,
    "notes": "Plastificação das páginas internas"
  }'
```

---

## 🎯 Passo 3: Criar Configurações Dinâmicas

### Configuração 1: Número de Páginas
```bash
curl -X POST http://localhost:3001/api/catalog/products/clr123abc456def789/configurations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{
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
  }'
```

**💾 Anote o ID:** `config-paginas-id`

### Configuração 2: Tipo de Capa
```bash
curl -X POST http://localhost:3001/api/catalog/products/clr123abc456def789/configurations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{
    "name": "Tipo de Capa",
    "type": "SELECT",
    "required": true,
    "affectsComponents": true,
    "affectsPricing": true,
    "displayOrder": 2
  }'
```

**💾 Anote o ID:** `config-capa-id`

#### Adicionar Opção: Capa Flexível
```bash
curl -X POST http://localhost:3001/api/catalog/configurations/config-capa-id/options \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{
    "label": "Capa Flexível (Couché 300g)",
    "value": "soft_cover",
    "priceModifier": 0,
    "additionalComponents": [
      {
        "materialId": "ID_DO_PAPEL_COUCH",
        "consumptionMethod": "BOUNDING_BOX",
        "formula": "2"
      }
    ],
    "displayOrder": 1
  }'
```

#### Adicionar Opção: Capa Dura
```bash
curl -X POST http://localhost:3001/api/catalog/configurations/config-capa-id/options \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{
    "label": "Capa Dura (Papelão + Adesivo)",
    "value": "hard_cover",
    "priceModifier": 15.00,
    "additionalComponents": [
      {
        "materialId": "ID_DO_PAPELAO",
        "consumptionMethod": "BOUNDING_BOX",
        "formula": "2"
      }
    ],
    "displayOrder": 2
  }'
```

### Configuração 3: Tipo de Encadernação
```bash
curl -X POST http://localhost:3001/api/catalog/products/clr123abc456def789/configurations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{
    "name": "Tipo de Encadernação",
    "type": "SELECT",
    "required": true,
    "affectsComponents": true,
    "affectsPricing": true,
    "displayOrder": 3
  }'
```

**💾 Anote o ID:** `config-encadernacao-id`

#### Opção: Grampo
```bash
curl -X POST http://localhost:3001/api/catalog/configurations/config-encadernacao-id/options \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{
    "label": "Encadernação Simples (Grampo)",
    "value": "staple",
    "priceModifier": 0,
    "additionalComponents": [
      {
        "materialId": "ID_DO_GRAMPO",
        "consumptionMethod": "FIXED_AMOUNT",
        "formula": "2"
      }
    ],
    "displayOrder": 1
  }'
```

#### Opção: Wire-o
```bash
curl -X POST http://localhost:3001/api/catalog/configurations/config-encadernacao-id/options \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{
    "label": "Wire-o",
    "value": "wire_o",
    "priceModifier": 8.00,
    "additionalComponents": [
      {
        "materialId": "ID_DO_WIRE_O",
        "consumptionMethod": "FIXED_AMOUNT",
        "formula": "1"
      }
    ],
    "displayOrder": 2
  }'
```

### Configuração 4: Montagem de Arte
```bash
curl -X POST http://localhost:3001/api/catalog/products/clr123abc456def789/configurations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{
    "name": "Montagem de Arte",
    "type": "BOOLEAN",
    "required": false,
    "defaultValue": "false",
    "affectsComponents": false,
    "affectsPricing": true,
    "displayOrder": 4
  }'
```

---

## 🎯 Passo 4: Testar as Configurações

### Ver todas as configurações do produto
```bash
curl -X GET http://localhost:3001/api/catalog/products/clr123abc456def789/configurations/complete \
  -H "Authorization: Bearer SEU_TOKEN"
```

### Validar uma seleção do cliente
```bash
curl -X POST http://localhost:3001/api/catalog/products/clr123abc456def789/configurations/validate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{
    "selectedConfigurations": {
      "config-paginas-id": "8",
      "config-capa-id": "hard_cover",
      "config-encadernacao-id": "wire_o",
      "config-montagem-id": "true"
    }
  }'
```

**Resposta esperada:**
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

## 🎨 Como Ficará na Interface

Quando o cliente for fazer um pedido, ele verá:

```
┌─ Cardápio Encadernado ─────────────────────────────────────┐
│                                                            │
│ Dimensões: 210mm × 297mm (A4)                            │
│ Quantidade: [10] unidades                                  │
│                                                            │
│ ┌─ Personalize seu Cardápio ─────────────────────────────┐ │
│ │                                                        │ │
│ │ 📄 Número de Páginas: [8] ▼                          │ │
│ │    (4, 8, 12, 16, 20, 24...)                         │ │
│ │                                                        │ │
│ │ 📋 Tipo de Capa:                                      │ │
│ │    ○ Flexível (Couché 300g)      R$ 0,00             │ │
│ │    ● Dura (Papelão + Adesivo)   +R$ 15,00            │ │
│ │                                                        │ │
│ │ 📎 Encadernação:                                      │ │
│ │    ○ Simples (Grampo)            R$ 0,00             │ │
│ │    ● Wire-o                     +R$ 8,00             │ │
│ │                                                        │ │
│ │ 🎨 Montagem de Arte:                                  │ │
│ │    ☑ Incluir montagem           +R$ 25,00            │ │
│ │                                                        │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                            │
│ ┌─ Materiais Calculados ──────────────────────────────────┐ │
│ │ ✓ Papel Couché 300g: 42 folhas     R$ 105,00         │ │
│ │ ✓ Plastificação: 43 folhas         R$ 382,70         │ │
│ │ ✓ Capa Dura: 21 folhas             R$ 79,80          │ │
│ │ ✓ Wire-o: 10 espirais              R$ 12,00          │ │
│ │                                                        │ │
│ │ 💰 TOTAL: R$ 1.059,50 (R$ 105,95 por unidade)       │ │
│ └────────────────────────────────────────────────────────┘ │
│                                                            │
│ [Adicionar ao Pedido]                                     │
└────────────────────────────────────────────────────────────┘
```

---

## 🔥 Vantagens do Sistema

### ✅ **Para Você (Administrador)**
- **1 produto** = infinitas variações
- **Sem duplicação** de cadastros
- **Cálculo automático** de materiais
- **Controle total** sobre opções e preços

### ✅ **Para o Cliente**
- **Interface intuitiva** com opções claras
- **Preço em tempo real** conforme escolhas
- **Transparência total** dos materiais
- **Personalização completa**

### ✅ **Para a Produção**
- **Lista exata** de materiais necessários
- **Quantidades precisas** calculadas automaticamente
- **Rastreamento de perdas** para melhoria contínua
- **Otimização de estoque**

---

## 🚀 Próximos Passos

1. **Teste as APIs** com seus materiais reais
2. **Configure seus produtos** mais vendidos
3. **Implemente no frontend** (próxima tarefa)
4. **Treine a equipe** no novo sistema

---

**🎯 Resultado Final**

Agora você tem um sistema onde:
- **1 produto** pode ter **centenas de variações**
- **Cálculos automáticos** de materiais e preços
- **Interface dinâmica** que se adapta às escolhas
- **Controle total** sobre configurações e custos

**Não precisa mais criar "Cardápio Wire-o Capa Dura", "Cardápio Grampo Capa Flexível", etc. Um único produto resolve tudo!** 🚀