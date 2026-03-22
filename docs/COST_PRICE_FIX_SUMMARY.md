# Correção dos Campos de Preço Obrigatórios - Resumo

## Problema Identificado

**Erro Prisma**: `Argument 'costPrice' is missing.`
```
PrismaClientValidationError: Invalid `prisma.order.create()` invocation
Argument `costPrice` is missing.
```

## Campos Obrigatórios no OrderItem

Segundo o schema Prisma (`backend/prisma/schema.prisma`):
```prisma
model OrderItem {
  // ... outros campos ...
  
  // Preços (a tríade vital)
  costPrice       Decimal @db.Decimal(10,2) // ❌ Custo interno - OBRIGATÓRIO
  calculatedPrice Decimal @db.Decimal(10,2) // ❌ Preço sugerido - OBRIGATÓRIO  
  unitPrice       Decimal @db.Decimal(10,2) // ✅ Preço praticado - JÁ ENVIADO
  totalPrice      Decimal @db.Decimal(10,2) // ✅ unitPrice * quantity - JÁ ENVIADO
}
```

## Correções Aplicadas

### 1. Schema de Validação Atualizado
```typescript
// ANTES: Campos obrigatórios faltando
const createOrderSchema = z.object({
  customerId: z.string().min(1),
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().positive(),
    unitPrice: z.number().positive(),
    totalPrice: z.number().positive()
    // ❌ costPrice e calculatedPrice faltando
  }))
});

// DEPOIS: Campos opcionais adicionados
const createOrderSchema = z.object({
  customerId: z.string().min(1),
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().positive(),
    unitPrice: z.number().positive(),
    totalPrice: z.number().positive(),
    costPrice: z.number().positive().optional(), // ✅ Opcional no frontend
    calculatedPrice: z.number().positive().optional() // ✅ Opcional no frontend
  }))
});
```

### 2. Criação de Pedidos (POST)
```typescript
// ANTES: Campos obrigatórios faltando
items: {
  create: body.items.map(item => ({
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: item.totalPrice
    // ❌ costPrice e calculatedPrice faltando
  }))
}

// DEPOIS: Campos com valores padrão
items: {
  create: body.items.map(item => ({
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: item.totalPrice,
    costPrice: item.costPrice || 0, // ✅ Padrão: 0 (sem custo definido)
    calculatedPrice: item.calculatedPrice || item.unitPrice // ✅ Padrão: mesmo que unitPrice
  }))
}
```

### 3. Atualização de Pedidos (PUT)
```typescript
// Mesma lógica aplicada no update de pedidos
updateData.items = {
  create: body.items.map(item => ({
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: item.totalPrice,
    costPrice: item.costPrice || 0, // ✅ Padrão: 0
    calculatedPrice: item.calculatedPrice || item.unitPrice // ✅ Padrão: unitPrice
  }))
};
```

## Lógica dos Valores Padrão

### costPrice (Custo Interno)
- **Padrão**: `0` (zero)
- **Razão**: Para itens de serviço, o custo pode ser zero ou não definido
- **Futuro**: Pode ser calculado baseado em materiais e tempo

### calculatedPrice (Preço Sugerido)
- **Padrão**: `item.unitPrice` (mesmo valor do preço praticado)
- **Razão**: Se não há cálculo específico, assume o preço definido pelo usuário
- **Futuro**: Pode ser calculado por algoritmos de precificação

## Arquivos Modificados

- `backend/src/modules/sales/sales.routes.express.optimized.ts`
  - Atualizado schema de validação Zod
  - Adicionado `costPrice` e `calculatedPrice` na criação
  - Adicionado `costPrice` e `calculatedPrice` na atualização

## Status das Correções

✅ **Subtotal**: Campo adicionado
✅ **OrderStatus**: Valor corrigido para 'DRAFT'  
✅ **CostPrice**: Campo adicionado com padrão 0
✅ **CalculatedPrice**: Campo adicionado com padrão unitPrice
✅ **Schema Prisma**: Todos os campos obrigatórios atendidos

## Teste das Correções

### Cenário: Criar Novo Pedido
1. Selecionar cliente ✅
2. Adicionar item de serviço ✅
3. Salvar pedido → ✅ Deve funcionar agora

### Resultado Esperado no Banco
```json
{
  "id": "uuid-do-item",
  "productId": "service-service-1768173674910",
  "quantity": 1,
  "unitPrice": 30.00,
  "totalPrice": 30.00,
  "costPrice": 0.00, ✅
  "calculatedPrice": 30.00, ✅
  "itemType": "SERVICE"
}
```

## Próximos Passos

1. **Testar criação**: Criar novo pedido
2. **Verificar banco**: Confirmar que todos os campos estão salvos
3. **Testar edição**: Editar pedido existente
4. **Validar cálculos**: Verificar se preços estão corretos

## Comandos para Teste

```bash
# Testar criação de pedido:
1. Frontend: http://localhost:3001/pedidos/criar
2. Selecionar cliente
3. Adicionar item de serviço (descrição, briefing, preço 30)
4. Salvar pedido
5. Verificar se não há mais erro 500
6. Confirmar redirecionamento e mensagem de sucesso
```

## Observações Importantes

- **Frontend não precisa mudar**: Os campos são opcionais na validação
- **Valores padrão**: Backend define automaticamente os valores faltantes
- **Compatibilidade**: Funciona com dados existentes e novos
- **Flexibilidade**: Permite enviar costPrice/calculatedPrice se necessário no futuro