# 🔍 Debug: Materiais não Aparecem na Página de Produtos

## 🎯 Problema

Os materiais configurados não estão aparecendo na página de produtos, mesmo sabendo que existem no banco de dados.

## 🧪 Testes Realizados

### ✅ Backend Confirmado
- **API funcionando**: `/api/catalog/products` retorna componentes
- **Dados no banco**: Cartão de Visita tem 3 materiais configurados
- **Estrutura correta**: Componentes incluem material.name, format, etc.

### 🔍 Debug Adicionado

#### 1. Logs no Frontend
```typescript
// Em loadProdutos()
console.log('🔍 Produtos carregados:', response.data.data);
console.log('📦 Produtos com componentes:', produtosComComponentes.length);
console.log('🎴 Cartões encontrados:', cartoes);

// Na renderização
if (produto.name.toLowerCase().includes('cartão')) {
  console.log('🎴 Renderizando cartão:', produto.name, 'Componentes:', produto.components?.length || 0);
}
```

#### 2. Debug Visual na Interface
- Produtos sem materiais mostram: "⚠️ Sem materiais (Debug: ...)"
- Produtos com materiais mostram: "🟢 X materiais"

## 📋 Como Testar

### 1. Console do Navegador
1. Abra a página de Produtos
2. Abra o console (F12)
3. Verifique os logs:
   - `🔍 Produtos carregados:` - deve mostrar array com produtos
   - `🎴 Cartões encontrados:` - deve mostrar 2 cartões
   - `🎴 Renderizando cartão:` - deve mostrar componentes

### 2. Script de Debug Manual
1. Copie o conteúdo de `frontend/src/debug-produtos.js`
2. Cole no console do navegador
3. Execute para testar a API diretamente

### 3. Verificar Resposta da API
```javascript
// No console do navegador
fetch('/api/catalog/products', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json'
  }
})
.then(r => r.json())
.then(data => {
  console.log('API Response:', data);
  const cartoes = data.data.filter(p => p.name.includes('Cartão'));
  console.log('Cartões:', cartoes);
});
```

## 🔧 Possíveis Causas

### 1. **Problema de Autenticação**
- Token expirado ou inválido
- Headers não sendo enviados corretamente

### 2. **Problema de CORS/Proxy**
- Requisição não chegando ao backend
- Proxy do Vite não funcionando

### 3. **Problema de Serialização**
- Dados sendo perdidos na resposta
- Campos não sendo incluídos

### 4. **Problema de Estado React**
- Estado não sendo atualizado
- Re-renderização não acontecendo

## 🎯 Próximos Passos

1. **Execute os testes de debug** no console
2. **Verifique os logs** na página de produtos
3. **Confirme se a API está sendo chamada** corretamente
4. **Verifique se os dados estão chegando** no frontend

## 📁 Arquivos Modificados

- ✅ `frontend/src/pages/Produtos.tsx` - Logs de debug adicionados
- ✅ `frontend/src/debug-produtos.js` - Script de teste manual
- ✅ Interface com debug visual temporário

## 🚨 Status: **EM DEBUG**

Execute os testes e me informe o que aparece no console!