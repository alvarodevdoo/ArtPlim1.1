# Guia de Migração - Monolito Modular com DDD

## Status da Migração

### ✅ Concluído
- [x] Estrutura base de pastas
- [x] Código compartilhado movido para `shared/`
- [x] Módulo de vendas refatorado (`sales-new/`)
- [x] Value Objects implementados (`Money`, `Dimensions`, `OrderNumber`, `OrderStatus`)
- [x] Entidades de domínio (`Order`, `OrderItem`)
- [x] Casos de uso principais
- [x] Repositório com Prisma
- [x] Controller HTTP
- [x] Sistema de módulos

### 🔄 Em Progresso
- [ ] Testes do novo módulo de vendas
- [ ] Integração com rotas existentes

### ⏳ Pendente
- [ ] Migração dos outros módulos
- [ ] Remoção do código antigo
- [ ] Documentação da API

## Como Testar a Nova Estrutura

### 1. Verificar Compilação
```bash
cd backend
npm run build
```

### 2. Testar Rotas (quando integradas)
```bash
# Criar pedido
POST /api/sales/orders
{
  "customerId": "uuid",
  "items": [
    {
      "productId": "uuid",
      "width": 100,
      "height": 200,
      "quantity": 1
    }
  ]
}

# Listar pedidos
GET /api/sales/orders

# Buscar pedido
GET /api/sales/orders/:id

# Atualizar status
PATCH /api/sales/orders/:id/status
{
  "status": "APPROVED"
}
```

## Comparação: Antes vs Depois

### Antes (Estrutura Antiga)
```
backend/src/
├── @core/
│   ├── database/prisma.ts
│   ├── errors/AppError.ts
│   ├── middleware/auth.ts
│   └── pricing-engine/PricingEngine.ts
├── modules/
│   ├── sales/
│   │   ├── services/OrderService.ts (800+ linhas!)
│   │   └── sales.routes.ts
│   └── ...
└── app.ts
```

**Problemas:**
- `OrderService.ts` com 800+ linhas
- Mistura de responsabilidades
- Difícil de testar
- Difícil de manter
- Acoplamento alto

### Depois (Nova Estrutura)
```
backend/src/
├── shared/
│   ├── infrastructure/
│   │   ├── database/prisma.ts
│   │   ├── errors/AppError.ts
│   │   └── auth/middleware.ts
│   ├── domain/value-objects/
│   │   ├── Money.ts
│   │   └── Dimensions.ts
│   └── application/pricing/
│       └── PricingEngine.ts
├── modules/
│   └── sales-new/
│       ├── domain/
│       │   ├── entities/
│       │   │   ├── Order.ts
│       │   │   └── OrderItem.ts
│       │   ├── value-objects/
│       │   │   ├── OrderNumber.ts
│       │   │   └── OrderStatus.ts
│       │   └── repositories/
│       │       └── OrderRepository.ts
│       ├── application/
│       │   ├── use-cases/
│       │   │   ├── CreateOrderUseCase.ts
│       │   │   ├── GetOrderUseCase.ts
│       │   │   ├── ListOrdersUseCase.ts
│       │   │   └── UpdateOrderStatusUseCase.ts
│       │   └── dto/
│       │       └── CreateOrderDTO.ts
│       ├── infrastructure/
│       │   └── repositories/
│       │       └── PrismaOrderRepository.ts
│       ├── presentation/
│       │   └── http/
│       │       ├── OrderController.ts
│       │       └── routes.ts
│       └── SalesModule.ts
└── app.ts
```

**Benefícios:**
- Responsabilidades bem definidas
- Arquivos menores e focados
- Fácil de testar cada parte
- Fácil de encontrar código
- Baixo acoplamento
- Alta coesão

## Principais Melhorias

### 1. Separação de Responsabilidades
**Antes:** Tudo no `OrderService.ts`
```typescript
// 800+ linhas fazendo tudo:
// - Validação
// - Cálculo de preços
// - Persistência
// - Lógica de negócio
// - Formatação de dados
// - Exportação Excel
```

**Depois:** Cada classe tem uma responsabilidade
```typescript
// CreateOrderUseCase.ts - Apenas criar pedidos
// GetOrderUseCase.ts - Apenas buscar pedidos
// Order.ts - Apenas regras de negócio do pedido
// PrismaOrderRepository.ts - Apenas persistência
// OrderController.ts - Apenas HTTP
```

### 2. Testabilidade
**Antes:** Difícil de testar
```typescript
// Para testar criação de pedido, precisa:
// - Banco de dados
// - Prisma configurado
// - Dados de teste complexos
```

**Depois:** Fácil de testar
```typescript
// Pode testar cada parte isoladamente:
// - Order.ts sem banco
// - CreateOrderUseCase.ts com mocks
// - PrismaOrderRepository.ts com banco de teste
```

### 3. Manutenibilidade
**Antes:** Mudança em uma funcionalidade afeta outras
```typescript
// Alterar cálculo de preço pode quebrar exportação
// Alterar validação pode quebrar listagem
```

**Depois:** Mudanças isoladas
```typescript
// Alterar Order.ts não afeta PrismaOrderRepository.ts
// Alterar CreateOrderUseCase.ts não afeta GetOrderUseCase.ts
```

### 4. Clareza do Código
**Antes:** Difícil de entender o que cada método faz
```typescript
class OrderService {
  async create() { /* 100 linhas */ }
  async update() { /* 150 linhas */ }
  async exportOrders() { /* 200 linhas */ }
  // ...
}
```

**Depois:** Intenção clara
```typescript
class CreateOrderUseCase {
  async execute() { /* 50 linhas focadas */ }
}

class Order {
  approve() { /* Regra de negócio clara */ }
  cancel() { /* Regra de negócio clara */ }
}
```

## Próximos Passos

### 1. Validar Nova Estrutura
- [ ] Testar compilação
- [ ] Testar rotas (quando integradas)
- [ ] Verificar se não quebrou nada

### 2. Migrar Outros Módulos
- [ ] `catalog` → `catalog-new`
- [ ] `auth` → `identity`
- [ ] `production` → `production-new`
- [ ] `wms` → `inventory`
- [ ] `finance` → `finance-new`

### 3. Limpeza
- [ ] Remover pastas antigas após validação
- [ ] Atualizar imports
- [ ] Atualizar documentação

### 4. Melhorias
- [ ] Adicionar testes unitários
- [ ] Implementar Domain Events
- [ ] Melhorar validações
- [ ] Documentar APIs

## Comandos Úteis

```bash
# Verificar estrutura
tree backend/src -I node_modules

# Compilar TypeScript
cd backend && npm run build

# Executar testes (quando implementados)
cd backend && npm test

# Verificar imports quebrados
cd backend && npx tsc --noEmit
```

## Dúvidas Frequentes

### Q: Por que não migrar tudo de uma vez?
**R:** Migração gradual reduz riscos e permite validação incremental.

### Q: O que acontece com o código antigo?
**R:** Mantemos até validar que o novo funciona, depois removemos.

### Q: Como garantir que não quebrou nada?
**R:** Testes automatizados e validação manual das funcionalidades.

### Q: Vale a pena todo esse trabalho?
**R:** Sim! A manutenibilidade e clareza do código melhoram drasticamente.