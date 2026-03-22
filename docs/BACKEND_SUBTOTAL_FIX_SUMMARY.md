# Correção do Campo Subtotal no Backend - Resumo

## Problema Identificado

**Erro Prisma**: `Argument 'subtotal' is missing`
```
PrismaClientValidationError: Invalid `prisma.order.create()` invocation
Argument `subtotal` is missing.
```

**Causa**: O schema do Prisma exige o campo `subtotal` mas o código não estava fornecendo

## Dados do Frontend (Corretos) ✅

O frontend agora está enviando dados válidos:
```json
{
  "customerId": "bbc2e025-7ca4-48d7-854b-e5aa9f78b655",
  "items": [{
    "productId": "service-service-1768173674910", ✅
    "itemType": "SERVICE", ✅
    "quantity": 1, ✅
    "unitPrice": 30, ✅
    "totalPrice": 30, ✅
    "attributes": {
      "description": "asdfdasd",
      "briefing": "121a23asdf", 
      "estimatedHours": 0
    }
  }]
}
```

## Correções Aplicadas no Backend

### 1. Criação de Pedidos (POST /api/sales/orders)
```typescript
// ANTES: Faltava subtotal
const order = await prisma.order.create({
  data: {
    organizationId: req.user.organizationId,
    customerId: body.customerId,
    orderNumber,
    status: 'PENDING',
    total, // ❌ Faltava subtotal
    notes: body.notes,
    ...
  }
});

// DEPOIS: Com subtotal
const order = await prisma.order.create({
  data: {
    organizationId: req.user.organizationId,
    customerId: body.customerId,
    orderNumber,
    status: 'PENDING',
    total,
    subtotal: total, // ✅ Adicionado
    notes: body.notes,
    ...
  }
});
```

### 2. Atualização de Pedidos (PUT /api/sales/orders/:id)
```typescript
// ANTES: Faltava subtotal no update
if (body.items) {
  updateData.total = body.items.reduce((sum, item) => sum + item.totalPrice, 0);
}

// DEPOIS: Com subtotal no update
if (body.items) {
  const total = body.items.reduce((sum, item) => sum + item.totalPrice, 0);
  updateData.total = total;
  updateData.subtotal = total; // ✅ Adicionado
}
```

## Arquivos Modificados

- `backend/src/modules/sales/sales.routes.express.optimized.ts`
  - Adicionado `subtotal: total` na criação de pedidos
  - Adicionado `subtotal: total` na atualização de pedidos

## Lógica do Subtotal

Por enquanto, `subtotal = total` (sem descontos ou taxas adicionais).
No futuro, pode ser implementado como:
```typescript
const subtotal = body.items.reduce((sum, item) => sum + item.totalPrice, 0);
const discount = body.discount || 0;
const tax = body.tax || 0;
const total = subtotal - discount + tax;
```

## Status das Correções

✅ **Frontend**: Dados válidos sendo enviados
✅ **Backend Create**: Campo subtotal adicionado
✅ **Backend Update**: Campo subtotal adicionado
✅ **Schema Prisma**: Atendido

## Teste das Correções

### Cenário 1: Criar Novo Pedido
1. Selecionar cliente ✅
2. Adicionar item de serviço ✅
3. Salvar pedido → ✅ Deve funcionar agora

### Cenário 2: Editar Pedido Existente
1. Abrir pedido para edição
2. Modificar itens
3. Salvar alterações → ✅ Deve funcionar

## Próximos Passos

1. **Testar criação**: Criar novo pedido com item de serviço
2. **Verificar banco**: Confirmar que pedido foi salvo
3. **Testar edição**: Editar pedido existente
4. **Validar dados**: Verificar se subtotal está correto

## Comandos para Teste

```bash
# Backend rodando em: http://localhost:3001
# Frontend rodando em: http://localhost:3001

# Para testar:
1. Navegar para /pedidos/criar
2. Selecionar cliente "Alberto"
3. Adicionar item de serviço com:
   - Descrição: "Teste"
   - Briefing: "Teste briefing"
   - Quantidade: 1
   - Preço: 30
4. Salvar pedido
5. Verificar se não há mais erro 500
```

## Resultado Esperado

✅ **Sucesso**: Pedido criado com mensagem "Pedido criado com sucesso!"
✅ **Redirecionamento**: Para página de listagem de pedidos
✅ **Banco de Dados**: Pedido salvo com subtotal = total