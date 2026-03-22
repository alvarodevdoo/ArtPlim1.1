# Debug de Validação de Itens - Melhorias

## Problema Atual
Usuário ainda recebe erro: "Existem 1 item(ns) com dados incompletos"

## Melhorias de Debug Implementadas

### 1. Validação Detalhada por Campo
```typescript
// ANTES: Validação simples
const itensInvalidos = itens.filter(item =>
  !item.productId || !item.quantity || item.quantity <= 0 || ...
);

// DEPOIS: Validação com detalhes específicos
const itensInvalidos = itens.filter(item => {
  const problems = [];
  
  if (!item.productId || item.productId.trim() === '') problems.push('productId vazio');
  if (!item.quantity || item.quantity <= 0 || isNaN(item.quantity)) problems.push('quantity inválida');
  if (!item.unitPrice || item.unitPrice <= 0 || isNaN(item.unitPrice)) problems.push('unitPrice inválido');
  if (!item.totalPrice || item.totalPrice <= 0 || isNaN(item.totalPrice)) problems.push('totalPrice inválido');
  
  if (problems.length > 0) {
    console.error(`❌ Item ${item.id} tem problemas:`, problems, {
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      itemType: item.itemType
    });
    return true;
  }
  return false;
});
```

### 2. Log Detalhado de Itens Inválidos
```typescript
// Log individual de cada item com problema
itensInvalidos.forEach((item, index) => {
  console.error(`❌ Item ${index + 1} inválido:`, {
    id: item.id,
    itemType: item.itemType,
    productId: item.productId,
    productIdValid: !!item.productId,
    quantity: item.quantity,
    quantityValid: item.quantity > 0,
    unitPrice: item.unitPrice,
    unitPriceValid: item.unitPrice > 0,
    totalPrice: item.totalPrice,
    totalPriceValid: item.totalPrice > 0,
    product: item.product?.name || 'null'
  });
});
```

### 3. Log de Todos os Itens para Comparação
```typescript
console.log('📋 Dados do pedido a serem enviados:', {
  customerId: clienteSelecionado.id,
  itemsCount: itens.length,
  items: itens.map(item => ({
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: item.totalPrice,
    itemType: item.itemType,
    isValid: !!(item.productId && item.quantity > 0 && item.unitPrice > 0 && item.totalPrice > 0)
  }))
});
```

## Verificações Adicionais

### Campos Verificados:
1. **productId**: Não pode ser vazio ou apenas espaços
2. **quantity**: Deve ser > 0 e não NaN
3. **unitPrice**: Deve ser > 0 e não NaN  
4. **totalPrice**: Deve ser > 0 e não NaN

### Possíveis Causas do Problema:
1. **Valores NaN**: Cálculos matemáticos resultando em NaN
2. **Strings vazias**: productId com apenas espaços
3. **Valores zero**: Preços ou quantidades zeradas
4. **Tipos incorretos**: Strings onde deveria ser números

## Como Usar o Debug

### 1. Reproduzir o Erro
1. Adicionar um item ao pedido
2. Tentar salvar
3. Verificar console do navegador

### 2. Analisar os Logs
```
❌ Item 1768173079152 tem problemas: ['unitPrice inválido'] {
  productId: "service-service-1768173079152",
  quantity: 1,
  unitPrice: NaN,  // ← PROBLEMA ENCONTRADO
  totalPrice: NaN,
  itemType: "SERVICE"
}
```

### 3. Identificar a Causa
- Se `unitPrice` é NaN → Problema no cálculo de preço
- Se `productId` é vazio → Problema na geração do ID
- Se `quantity` é 0 → Problema no formulário

## Próximos Passos

1. **Executar teste**: Adicionar item e tentar salvar
2. **Verificar console**: Analisar logs detalhados
3. **Identificar campo**: Ver qual campo específico está inválido
4. **Corrigir origem**: Ajustar AddItemForm conforme necessário

## Status

✅ **Debug melhorado**: Logs detalhados implementados
🔍 **Aguardando teste**: Precisa reproduzir erro para ver detalhes
🛠️ **Próxima ação**: Corrigir campo específico identificado no log