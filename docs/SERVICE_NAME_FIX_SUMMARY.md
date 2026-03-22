# Correção de Exibição de Nome de Serviços

## Problema
Serviços do tipo "arte" não estavam mostrando o nome do serviço, apenas aparecendo como "Produto (ID: undefined)" com o ícone de produto (📦) ao invés do ícone de serviço (🎨).

Além disso, ao tentar salvar o pedido, aparecia o erro: "Existem 1 item(ns) com dados incompletos ou produtos inválidos."

## Causa Raiz
1. No `ServiceItemForm`, o item era criado com `productId: undefined` e `product: undefined`
2. A lógica de exibição em `CriarPedido` não tinha fallback para buscar o nome do serviço em `attributes.serviceName`
3. Todos os itens eram exibidos com o mesmo ícone e badge de "Produto", sem diferenciar serviços
4. A validação falhava porque o serviço não tinha um productId válido

## Solução Implementada

### 1. ServiceItemForm - Usar Produto Real Cadastrado
Modificado para receber o objeto `produto` completo (ao invés de apenas `serviceName`) e usar o ID real do produto/serviço cadastrado:

```typescript
interface ServiceItemFormProps {
    produto: {
        id: string;
        name: string;
        description?: string;
        pricingMode: 'SIMPLE_AREA' | 'SIMPLE_UNIT' | 'DYNAMIC_ENGINEER';
        salePrice?: number;
        minPrice?: number;
        productType?: ItemType;
    };
    onSubmit: (itemData: any) => void;
    editingData?: any;
    isEditing?: boolean;
}

const itemData = {
    productId: produto.id, // Usar o ID real do produto/serviço cadastrado
    product: produto, // Usar o objeto produto completo
    // ... resto dos campos
};
```

### 2. ItemConfigurationModal - Passar Produto Completo
Atualizado para passar o objeto `produto` completo para o ServiceItemForm:

```typescript
<ServiceItemForm
    produto={produto}
    onSubmit={handleItemSubmit}
    editingData={editingItem}
    isEditing={!!editingItem}
/>
```

### 3. CriarPedido - Exibição Diferenciada
Atualizada a lógica de exibição para:

1. **Detectar tipo de item:**
```typescript
const isService = item.itemType === ItemType.SERVICE;
```

2. **Fallback para nome do serviço:**
```typescript
{itemProduct?.name || item.attributes?.serviceName || `Produto (ID: ${item.productId})`}
```

3. **Badge e ícone diferenciados:**
```typescript
<span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${
  isService 
    ? 'bg-blue-100 text-blue-800 border-blue-200' 
    : 'bg-gray-100 text-gray-800 border-gray-200'
}`}>
  <span className="mr-1">{isService ? '🎨' : '📦'}</span>
  {isService ? 'Serviço' : 'Produto'}
</span>
```

## Arquivos Modificados

1. **frontend/src/components/pedidos/item-forms/ServiceItemForm.tsx**
   - Alterada interface para receber `produto` completo ao invés de apenas `serviceName`
   - Usa o ID real do produto cadastrado (`produto.id`)
   - Usa o objeto produto completo para preservar todas as informações
   - Adicionado import do ItemType

2. **frontend/src/components/pedidos/ItemConfigurationModal.tsx**
   - Passa o objeto `produto` completo para ServiceItemForm
   - Alterado import para importação direta dos componentes

3. **frontend/src/pages/CriarPedido.tsx**
   - Adicionada detecção de tipo de item (serviço vs produto)
   - Fallback para buscar nome em `attributes.serviceName`
   - Badge e ícone diferenciados por tipo
   - Cores diferentes: azul para serviços, cinza para produtos

## Resultado

Agora os serviços são exibidos corretamente com:
- ✅ Nome do serviço visível (ex: "Criação de Logo")
- ✅ Ícone de serviço (🎨) ao invés de produto (📦)
- ✅ Badge azul "Serviço" ao invés de cinza "Produto"
- ✅ Descrição do serviço nas observações
- ✅ Validação funciona corretamente pois usa o ID real do produto cadastrado
- ✅ Pedido pode ser salvo sem erros

## Exemplo Visual

**Antes:**
```
#2  Produto (ID: undefined)  📦 Produto
Qtd: 1 un
Observações: arte
[ERRO ao salvar: produto inválido]
```

**Depois:**
```
#2  Criação de Logo  🎨 Serviço
Qtd: 1 un
Observações: asdfa
[Salva com sucesso]
```
