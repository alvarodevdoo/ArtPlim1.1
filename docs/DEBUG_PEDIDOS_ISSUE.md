# Debug - Problema com Salvamento de Pedidos

## Problema Reportado
"As automações de pedidos não estão funcionando" / "não estão salvando as alterações"

## Evidências Encontradas

### 1. Erro de JSON Parsing
```
Global error handler: SyntaxError: Expected property name or '}' in JSON at position 1 (line 1 column 2)
body: '{\\',
type: 'entity.parse.failed'
```

### 2. Backend Funcionando
- ✅ Servidor rodando na porta 3001
- ✅ Redis conectado
- ✅ WebSocket inicializado
- ✅ Middleware configurado corretamente

### 3. Configuração JSON OK
```typescript
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
```

## Possíveis Causas

### 1. Problema no Frontend
- Dados sendo enviados com escape incorreto
- JSON malformado antes do envio
- Problema na serialização

### 2. Problema de Middleware
- Algum middleware interceptando e corrompendo o JSON
- Problema de encoding/charset

### 3. Problema de Rede/Proxy
- Proxy do Vite interferindo
- Problema de CORS

## Investigação Necessária

### Perguntas para o Usuário:
1. **Que tipo de alteração** você está tentando fazer?
   - [ ] Criar novo pedido
   - [ ] Editar pedido existente  
   - [ ] Alterar status
   - [ ] Adicionar/remover itens

2. **Quando acontece o problema?**
   - [ ] Sempre
   - [ ] Só em pedidos específicos
   - [ ] Só com certos tipos de item
   - [ ] Só ao editar

3. **Há mensagem de erro visível?**
   - [ ] Erro 500 no frontend
   - [ ] Mensagem específica
   - [ ] Falha silenciosa

### Testes a Fazer:

#### 1. Teste Manual no Frontend
```bash
# Abrir http://localhost:3001/pedidos/criar
# Tentar criar pedido simples
# Verificar Network tab no DevTools
```

#### 2. Teste Direto da API
```bash
# Testar POST direto com JSON válido
curl -X POST http://localhost:3001/api/sales/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"customerId":"ID","items":[...]}'
```

#### 3. Verificar Logs
```bash
# Monitorar logs do backend em tempo real
# Ver exatamente que JSON está chegando
```

## Próximos Passos

1. **Reproduzir o problema** - tentar criar/editar pedido
2. **Capturar dados** - ver exatamente que JSON está sendo enviado
3. **Identificar origem** - frontend, middleware, ou rede
4. **Aplicar correção** específica

## Status
🔍 **Investigando** - Aguardando mais detalhes do usuário sobre o problema específico