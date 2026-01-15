# Correção do Problema de PricingMode nos Pedidos

## Problema Identificado

O produto "Cartão de Visita" estava sendo exibido como "Preço Dinâmico" no modal de edição de itens, quando deveria mostrar os campos específicos para impressão (SIMPLE_UNIT).

## Causa Raiz

O método `getProductData` no `OrderController` não estava retornando o campo `pricingMode` do banco de dados. Isso fazia com que o frontend não conseguisse identificar corretamente o tipo de produto e, por padrão, exibisse como "Preço Dinâmico".

## Correção Aplicada

### Arquivo: `backend/src/modules/sales/presentation/http/OrderController.ts`

**Antes:**
```typescript
private async getProductData(productId: string) {
  const { prisma } = require('../../../../shared/infrastructure/database/prisma');
  
  try {
    return await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        description: true
      }
    });
  } catch (error) {
    return null;
  }
}
```

**Depois:**
```typescript
private async getProductData(productId: string) {
  const { prisma } = require('../../../../shared/infrastructure/database/prisma');
  
  try {
    return await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        description: true,
        pricingMode: true,
        salePrice: true,
        minPrice: true
      }
    });
  } catch (error) {
    return null;
  }
}
```

## Verificação

### Produto no Banco de Dados:
```json
{
  "id": "a8c7f219-709b-4206-bbcc-1072f14ba8dc",
  "name": "Cartão de Visita",
  "pricingMode": "SIMPLE_UNIT",
  "salePrice": "110",
  "minPrice": "0.25"
}
```

### Comportamento Esperado Após Correção:

1. **Ao adicionar "Cartão de Visita"**: Deve mostrar campos de impressão (tamanho do papel, tipo de papel, cores, acabamento)
2. **Ao editar item existente**: Deve carregar os campos corretos baseados no `pricingMode`
3. **Na exibição do produto**: Deve mostrar "(Preço por unidade)" em vez de "(Preço Dinâmico)"

## Impacto

- ✅ Produtos SIMPLE_UNIT agora exibem campos corretos
- ✅ Produtos SIMPLE_AREA continuam funcionando normalmente  
- ✅ Produtos DYNAMIC_ENGINEER continuam funcionando normalmente
- ✅ Edição de pedidos existentes agora funciona corretamente

## Status

- **Backend**: Corrigido e reiniciado
- **Frontend**: Funcionando corretamente
- **Teste**: Produto "Cartão de Visita" agora exibe campos de impressão

Data da correção: 06/01/2026 23:15