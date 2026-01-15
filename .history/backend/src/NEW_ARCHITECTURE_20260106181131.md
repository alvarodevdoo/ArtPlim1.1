# Nova Arquitetura - Monolito Modular com DDD

## Visão Geral

A nova arquitetura segue os princípios de **Domain-Driven Design (DDD)** organizados em um **Monolito Modular**. Cada módulo representa um **Bounded Context** do domínio de negócio.

## Estrutura de Pastas

```
backend/src/
├── shared/                          # Código compartilhado
│   ├── infrastructure/              # Infraestrutura técnica
│   ├── domain/                     # Conceitos de domínio compartilhados
│   └── application/                # Serviços de aplicação compartilhados
├── modules/                        # Módulos de domínio
│   ├── sales-new/                  # Contexto de Vendas (NOVO)
│   ├── identity/                   # Contexto de Identidade
│   ├── catalog/                    # Contexto de Catálogo
│   └── ...
└── app.ts                          # Configuração da aplicação
```

## Camadas da Arquitetura

### 1. Domain (Domínio)
- **Entities**: Objetos com identidade e ciclo de vida
- **Value Objects**: Objetos imutáveis que representam conceitos
- **Repositories**: Interfaces para persistência
- **Services**: Lógica de domínio complexa

### 2. Application (Aplicação)
- **Use Cases**: Casos de uso específicos
- **DTOs**: Objetos de transferência de dados
- **Services**: Orquestração de casos de uso

### 3. Infrastructure (Infraestrutura)
- **Repositories**: Implementações concretas
- **External Services**: Integrações externas

### 4. Presentation (Apresentação)
- **HTTP Controllers**: Controladores REST
- **Routes**: Definição de rotas

## Exemplo: Módulo de Vendas

### Entidades de Domínio
- `Order`: Pedido com regras de negócio
- `OrderItem`: Item do pedido
- `OrderNumber`: Número do pedido (Value Object)
- `OrderStatus`: Status do pedido (Value Object)

### Casos de Uso
- `CreateOrderUseCase`: Criar pedido
- `GetOrderUseCase`: Buscar pedido
- `ListOrdersUseCase`: Listar pedidos
- `UpdateOrderStatusUseCase`: Atualizar status

### Repositório
- `OrderRepository`: Interface do repositório
- `PrismaOrderRepository`: Implementação com Prisma

### Controller
- `OrderController`: Controlador HTTP
- `routes.ts`: Definição das rotas

## Benefícios

### 1. Separação de Responsabilidades
- Cada camada tem uma responsabilidade específica
- Domínio isolado de detalhes técnicos
- Fácil manutenção e evolução

### 2. Testabilidade
- Domínio pode ser testado sem infraestrutura
- Use cases isolados e focados
- Mocks fáceis de criar

### 3. Flexibilidade
- Mudanças na infraestrutura não afetam o domínio
- Novos casos de uso podem ser adicionados facilmente
- Módulos podem evoluir independentemente

### 4. Clareza
- Estrutura reflete o domínio do negócio
- Código mais fácil de encontrar e entender
- Documentação viva da arquitetura

## Migração Gradual

### Fase 1: Estrutura Base ✅
- [x] Criar estrutura de pastas
- [x] Mover código compartilhado para `shared/`
- [x] Implementar módulo de vendas como exemplo

### Fase 2: Outros Módulos
- [ ] Migrar módulo de catálogo
- [ ] Migrar módulo de identidade
- [ ] Migrar módulo de produção
- [ ] Migrar módulo de estoque
- [ ] Migrar módulo financeiro

### Fase 3: Refinamento
- [ ] Implementar Domain Events
- [ ] Adicionar validações robustas
- [ ] Melhorar tratamento de erros
- [ ] Adicionar testes unitários

## Como Usar

### 1. Criando um Novo Módulo

```typescript
// 1. Definir entidades de domínio
export class MyEntity {
  // Regras de negócio aqui
}

// 2. Definir repositório
export interface MyRepository {
  save(entity: MyEntity): Promise<MyEntity>;
}

// 3. Implementar casos de uso
export class CreateMyEntityUseCase {
  constructor(private repository: MyRepository) {}
  
  async execute(data: CreateDTO): Promise<MyEntity> {
    // Lógica do caso de uso
  }
}

// 4. Criar controller
export class MyController {
  // Endpoints HTTP
}

// 5. Registrar no módulo
export class MyModule {
  // Configuração de dependências
}
```

### 2. Integrando com a Aplicação

```typescript
// Em AppFactory.ts
const myModule = new MyModule(dependencies);
await fastify.register(async function (fastify) {
  await myModule.registerRoutes(fastify);
}, { prefix: '/api/my-module' });
```

## Convenções

### Nomenclatura
- **Entities**: PascalCase (ex: `Order`, `OrderItem`)
- **Value Objects**: PascalCase (ex: `OrderNumber`, `Money`)
- **Use Cases**: PascalCase + "UseCase" (ex: `CreateOrderUseCase`)
- **Repositories**: PascalCase + "Repository" (ex: `OrderRepository`)
- **Controllers**: PascalCase + "Controller" (ex: `OrderController`)

### Estrutura de Arquivos
- Um arquivo por classe
- Nomes de arquivo iguais ao nome da classe
- Organização por tipo (entities, use-cases, etc.)

### Dependências
- Domínio não depende de nada
- Aplicação depende apenas do domínio
- Infraestrutura implementa interfaces do domínio
- Apresentação depende da aplicação

## Próximos Passos

1. **Testar o módulo de vendas** com as rotas existentes
2. **Migrar outros módulos** seguindo o mesmo padrão
3. **Remover código antigo** após validação
4. **Adicionar testes** para garantir qualidade
5. **Documentar APIs** com Swagger/OpenAPI