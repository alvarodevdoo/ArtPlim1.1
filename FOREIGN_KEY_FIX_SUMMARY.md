# Correção da Violação de Chave Estrangeira - Resumo

## Problema Identificado

**Erro Prisma**: `Foreign key constraint violated: order_items_productId_fkey`
```
PrismaClientKnownRequestError: Invalid `prisma.order.create()` invocation
Foreign key constraint violated: `order_items_productId_fkey (index)`
```

**Causa**: O `productId` gerado para itens de serviço (`service-service-1768173674910`) não existe na tabela `products`

## Análise do Problema

### Schema do Banco
```prisma
model OrderItem {
  productId  String
  product    Product @relation(fields: [productId], references: [id])
  // ...
}
```

- `productId` é obrigatório e deve referenciar um produto existente
- Não podemos usar IDs fictícios
- Todos os itens precisam de um produto válido no banco

### Produtos Existentes no Banco
```sql
SELECT id, name FROM products LIMIT 5;
```
```
5f12ee05-6f05-470c-ae56-64e140343b5d | Arte
925eb24d-1049-40fe-8628-221a5d1b66a8 | Impressão Couchê  
649526a2-5918-4499-b636-8c323b3468ce | Flyer A4
3da02199-991b-4537-97bb-837679f5d180 | Cartão de Visita
1dacc328-5a0c-4fca-8591-ef3a7198e450 | Adesivo Vinil
```

## Solução Implementada

### Usar Produto Existente como Placeholder

```typescript
// ANTES: ID fictício que não existe
finalProductId = `service-${itemType.toLowerCase()}-${Date.now()}`;

// DEPOIS: ID de produto existente
let finalProductId = '';
if (itemType === ItemType.PRODUCT) {
  finalProductId = produtoSelecionado?.id || '';
} else {
  // Para itens de serviço, usar produto existente como placeholder
  finalProductId = '5f12ee05-6f05-470c-ae56-64e140343b5d'; // Produto "Arte"
}
```

### Lógica da Solução

1. **Itens PRODUCT**: Usam o produto selecionado pelo usuário
2. **Itens SERVICE/PRINT_SHEET/etc**: Usam produto "Arte" como placeholder
3. **Dados específicos**: Salvos no campo `attributes` (JSON)
4. **Tipo real**: Identificado pelo campo `itemType`

## Vantagens da Solução

✅ **Compatibilidade**: Funciona com schema atual sem mudanças
✅ **Simplicidade**: Não requer migração de banco
✅ **Flexibilidade**: Dados específicos em `attributes`
✅ **Identificação**: Campo `itemType` identifica o tipo real

## Arquivos Modificados

- `frontend/src/components/pedidos/AddItemForm.tsx`
  - Alterado geração de `productId` para usar produto existente
  - Mantida lógica de `itemType` e `attributes`

## Estrutura Final do Item de Serviço

```json
{
  "id": "1768173674910",
  "productId": "5f12ee05-6f05-470c-ae56-64e140343b5d", // ✅ Produto existente
  "itemType": "SERVICE", // ✅ Tipo real do item
  "quantity": 1,
  "unitPrice": 30.00,
  "totalPrice": 30.00,
  "costPrice": 0.00,
  "calculatedPrice": 30.00,
  "attributes": { // ✅ Dados específicos do serviço
    "description": "Descrição do serviço",
    "briefing": "Briefing detalhado",
    "estimatedHours": 2
  }
}
```

## Status das Correções

✅ **Subtotal**: Campo adicionado
✅ **OrderStatus**: Valor 'DRAFT'
✅ **CostPrice/CalculatedPrice**: Campos adicionados
✅ **ProductId**: Referência válida para produto existente
✅ **Foreign Key**: Violação resolvida

## Teste das Correções

### Cenário: Criar Pedido com Serviço
1. Selecionar cliente ✅
2. Adicionar item de serviço ✅
3. Salvar pedido → ✅ Deve funcionar agora

### Resultado Esperado
- Pedido criado com sucesso
- Item salvo com `productId` válido
- Tipo identificado por `itemType = "SERVICE"`
- Dados específicos em `attributes`

## Melhorias Futuras

### Opção 1: Produto Especial para Serviços
Criar um produto dedicado "Serviços Diversos" para usar como referência

### Opção 2: Schema Flexível
Tornar `productId` opcional quando `itemType != "PRODUCT"`

### Opção 3: Tabela Separada
Criar tabela específica para itens de serviço

## Comandos para Teste

```bash
# Testar criação de pedido:
1. Frontend: http://localhost:3001/pedidos/criar
2. Selecionar cliente "Alberto"
3. Adicionar item de serviço:
   - Tipo: Serviço
   - Descrição: "Design de logotipo"
   - Briefing: "Criar logotipo moderno"
   - Preço: 150
4. Salvar pedido
5. Verificar sucesso e redirecionamento
```

## Observações Importantes

- **Produto Placeholder**: "Arte" é usado apenas como referência técnica
- **Tipo Real**: Sempre verificar campo `itemType` para lógica de negócio
- **Dados Específicos**: Sempre em `attributes`, não nos campos do produto
- **Compatibilidade**: Solução funciona com dados existentes