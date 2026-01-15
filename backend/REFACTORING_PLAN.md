# Plano de Refatoração - Monolito Modular com DDD

## Estrutura Atual vs Nova Estrutura

### Problemas Identificados na Estrutura Atual:
1. Mistura de conceitos técnicos e de domínio
2. Serviços muito grandes e com múltiplas responsabilidades
3. Falta de separação clara entre camadas
4. Dependências circulares potenciais
5. Dificuldade para encontrar e manter código

### Nova Estrutura Proposta:

```
backend/src/
├── shared/                          # Código compartilhado entre domínios
│   ├── infrastructure/              # Infraestrutura técnica
│   │   ├── database/               # Configuração do Prisma
│   │   ├── http/                   # Configuração HTTP (Fastify)
│   │   ├── auth/                   # Autenticação e autorização
│   │   └── errors/                 # Tratamento de erros
│   ├── domain/                     # Conceitos de domínio compartilhados
│   │   ├── value-objects/          # Value Objects compartilhados
│   │   ├── events/                 # Domain Events
│   │   └── interfaces/             # Interfaces compartilhadas
│   └── application/                # Serviços de aplicação compartilhados
│       ├── pricing/                # Engine de precificação
│       └── notifications/          # Sistema de notificações
├── modules/                        # Módulos de domínio (Bounded Contexts)
│   ├── identity/                   # Contexto de Identidade e Acesso
│   │   ├── domain/
│   │   │   ├── entities/           # User, Profile, Organization
│   │   │   ├── value-objects/      # Email, Password, etc.
│   │   │   ├── repositories/       # Interfaces dos repositórios
│   │   │   └── services/           # Serviços de domínio
│   │   ├── application/
│   │   │   ├── use-cases/          # Casos de uso (Login, Register, etc.)
│   │   │   ├── dto/                # Data Transfer Objects
│   │   │   └── services/           # Serviços de aplicação
│   │   ├── infrastructure/
│   │   │   ├── repositories/       # Implementações dos repositórios
│   │   │   └── external/           # Serviços externos (email, etc.)
│   │   └── presentation/
│   │       ├── http/               # Controllers e rotas
│   │       └── dto/                # DTOs de apresentação
│   ├── catalog/                    # Contexto de Catálogo de Produtos
│   │   ├── domain/
│   │   │   ├── entities/           # Product, Material, Category
│   │   │   ├── value-objects/      # Price, Dimensions, etc.
│   │   │   ├── repositories/
│   │   │   └── services/
│   │   ├── application/
│   │   │   ├── use-cases/          # CreateProduct, UpdatePrice, etc.
│   │   │   └── services/
│   │   ├── infrastructure/
│   │   │   └── repositories/
│   │   └── presentation/
│   │       └── http/
│   ├── sales/                      # Contexto de Vendas
│   │   ├── domain/
│   │   │   ├── entities/           # Order, OrderItem, Quote
│   │   │   ├── value-objects/      # OrderNumber, Money, etc.
│   │   │   ├── repositories/
│   │   │   └── services/
│   │   ├── application/
│   │   │   ├── use-cases/          # CreateOrder, ApproveOrder, etc.
│   │   │   └── services/
│   │   ├── infrastructure/
│   │   │   └── repositories/
│   │   └── presentation/
│   │       └── http/
│   ├── production/                 # Contexto de Produção
│   │   └── [mesma estrutura]
│   ├── inventory/                  # Contexto de Estoque (WMS)
│   │   └── [mesma estrutura]
│   └── finance/                    # Contexto Financeiro
│       └── [mesma estrutura]
├── app.ts                          # Configuração da aplicação
└── server.ts                       # Ponto de entrada
```

## Princípios Aplicados:

### 1. Bounded Contexts (Contextos Delimitados)
- Cada módulo representa um contexto de negócio específico
- Separação clara de responsabilidades
- Redução de acoplamento entre contextos

### 2. Layered Architecture (Arquitetura em Camadas)
- **Domain**: Regras de negócio puras
- **Application**: Casos de uso e orquestração
- **Infrastructure**: Detalhes técnicos (BD, APIs externas)
- **Presentation**: Interface com o mundo externo

### 3. Dependency Inversion
- Domínio não depende de infraestrutura
- Interfaces definidas no domínio, implementadas na infraestrutura

### 4. Single Responsibility
- Cada classe/módulo tem uma única responsabilidade
- Serviços menores e mais focados

## Benefícios Esperados:

1. **Manutenibilidade**: Código mais organizado e fácil de encontrar
2. **Testabilidade**: Separação clara facilita testes unitários
3. **Escalabilidade**: Módulos podem evoluir independentemente
4. **Clareza**: Estrutura reflete o domínio do negócio
5. **Reutilização**: Código compartilhado bem organizado

## Plano de Migração:

1. Criar nova estrutura de pastas
2. Migrar código compartilhado para `shared/`
3. Reorganizar módulos por contexto de domínio
4. Refatorar serviços grandes em casos de uso menores
5. Implementar interfaces de repositório
6. Atualizar imports e dependências
7. Testes e validação