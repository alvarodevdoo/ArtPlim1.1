# Componentes de Pedidos - Arquitetura Modular

## Visão Geral

A arquitetura dos componentes de pedidos foi refatorada para ser mais modular e maintível, eliminando o arquivo monolítico anterior.

## Estrutura

```
pedidos/
├── AddItemFormSimplified.tsx    # Componente principal simplificado
├── item-forms/                  # Formulários específicos por tipo
│   ├── index.ts                # Exports centralizados
│   ├── ProductItemForm.tsx     # Formulário para produtos
│   └── ServiceItemForm.tsx     # Formulário para serviços
└── README.md                   # Esta documentação
```

## Componentes

### AddItemFormSimplified

**Responsabilidades:**
- Seleção de produto/serviço
- Determinação automática do tipo (produto vs serviço)
- Carregamento do componente específico apropriado
- Gerenciamento de estado global do formulário

**Props:**
- `produtos`: Lista de produtos/serviços disponíveis
- `onAddItem`: Callback para adicionar item
- `onUpdateItem`: Callback para atualizar item (opcional)
- `editingItem`: Item sendo editado (opcional)
- `isModal`: Se deve renderizar como modal
- `onCancel`: Callback para cancelar (opcional)

### ProductItemForm

**Responsabilidades:**
- Formulário específico para produtos
- Campos de dimensões (para produtos por área)
- Cálculo automático de preços
- Simulação de preços via API

**Tipos de Produto Suportados:**
- `SIMPLE_AREA`: Produtos vendidos por m² (requer dimensões)
- `SIMPLE_UNIT`: Produtos vendidos por unidade
- `DYNAMIC_ENGINEER`: Produtos com preço dinâmico

### ServiceItemForm

**Responsabilidades:**
- Formulário específico para serviços/arte
- Campo de descrição do serviço
- Campo de briefing/observações
- Preço manual (sem cálculo automático)

## Detecção de Tipo

O sistema determina automaticamente se um item é produto ou serviço baseado em:

1. `produto.productType` contém "serviço" ou "arte"
2. `produto.name` contém "arte" ou "serviço"

## Fluxo de Uso

1. **Seleção**: Usuário busca e seleciona produto/serviço
2. **Detecção**: Sistema identifica o tipo automaticamente
3. **Carregamento**: Componente específico é carregado
4. **Preenchimento**: Usuário preenche campos específicos
5. **Submissão**: Dados são validados e enviados

## Vantagens da Nova Arquitetura

### ✅ Modularidade
- Cada tipo de item tem seu próprio componente
- Fácil adição de novos tipos
- Código mais organizado e maintível

### ✅ Simplicidade
- Usuário não precisa escolher tipo manualmente
- Interface mais limpa e intuitiva
- Menos passos no processo

### ✅ Manutenibilidade
- Arquivos menores e focados
- Lógica específica isolada
- Testes mais fáceis

### ✅ Extensibilidade
- Fácil adicionar novos tipos de item
- Componentes reutilizáveis
- Configuração flexível

## Migração do Código Antigo

O arquivo `AddItemForm.tsx` original foi mantido para referência, mas não é mais usado. A nova implementação:

- Remove a necessidade de seleção manual de tipo
- Simplifica a interface do usuário
- Mantém toda a funcionalidade existente
- Melhora a organização do código

## Adicionando Novos Tipos

Para adicionar um novo tipo de item:

1. Criar novo componente em `item-forms/`
2. Adicionar export no `index.ts`
3. Importar no `AddItemFormSimplified`
4. Adicionar lógica de detecção
5. Adicionar renderização condicional

Exemplo:
```tsx
// item-forms/LaserCutItemForm.tsx
const LaserCutItemForm = ({ onSubmit, editingData }) => {
  // Implementação específica para corte laser
};

// AddItemFormSimplified.tsx
const isLaserCut = produto.name.includes('laser');

{isLaserCut && (
  <LaserCutItemForm onSubmit={handleItemSubmit} />
)}
```