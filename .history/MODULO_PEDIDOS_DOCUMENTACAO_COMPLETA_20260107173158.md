# Documentação Completa do Módulo de Pedidos

## Visão Geral

O módulo de pedidos é o coração do sistema de gestão de ordens de serviço, responsável por gerenciar todo o ciclo de vida dos pedidos desde a criação até a entrega. O sistema suporta três tipos de produtos com diferentes modelos de precificação e oferece funcionalidades avançadas de automação, comunicação e análise financeira.

## Arquitetura do Sistema

### Frontend (React/TypeScript)

#### 1. **CriarPedido.tsx** - Página de Criação/Edição de Pedidos
- **Localização**: `frontend/src/pages/CriarPedido.tsx`
- **Responsabilidades**:
  - Interface para criar novos pedidos ou editar pedidos em rascunho
  - Seleção de cliente com busca inteligente
  - Adição/edição/remoção de itens do pedido
  - Cálculo automático de preços e totais
  - Validação de dados antes do salvamento
  - Suporte a diferentes tipos de produtos (área, unidade, dinâmico)

**Funcionalidades Principais**:
- **Seleção de Cliente**: Campo de busca com dropdown que filtra por nome ou documento
- **Gestão de Itens**: Modal para adicionar/editar itens com formulário específico por tipo de produto
- **Cálculo Automático**: Integração com MaterialCalculator para mostrar custos de materiais
- **Validação**: Verificação de campos obrigatórios e consistência de dados
- **Resumo Financeiro**: Sidebar com totais, área calculada e estatísticas do pedido

#### 2. **Pedidos.tsx** - Página de Listagem e Gestão de Pedidos
- **Localização**: `frontend/src/pages/Pedidos.tsx`
- **Responsabilidades**:
  - Listagem de todos os pedidos com filtros avançados
  - Dashboard com estatísticas e KPIs
  - Gestão de status dos pedidos
  - Comunicação via WhatsApp
  - Análise financeira e de rentabilidade
  - Automação de processos

**Funcionalidades Principais**:
- **Dashboard de Estatísticas**: Cards com métricas de total de pedidos, valor total, pedidos em andamento e vencidos
- **Filtros Avançados**: Por status, data, cliente, valor, com ordenação customizável
- **Visualizações**: Modo lista e kanban board para diferentes workflows
- **Ações em Lote**: Seleção múltipla para mudanças de status em massa
- **Comunicação**: Integração WhatsApp para notificações automáticas e mensagens personalizadas
- **Timeline de Produção**: Acompanhamento visual do progresso dos pedidos
- **Análise Financeira**: Cálculo de margem, custos e rentabilidade (apenas para usuários autorizados)

#### 3. **AddItemForm.tsx** - Componente de Adição/Edição de Itens
- **Localização**: `frontend/src/components/pedidos/AddItemForm.tsx`
- **Responsabilidades**:
  - Formulário dinâmico baseado no tipo de produto selecionado
  - Integração com MaterialCalculator para cálculo de materiais
  - Simulação automática de preços
  - Validação específica por tipo de produto

**Tipos de Produto Suportados**:

1. **SIMPLE_AREA** (Produtos por m²):
   - Campos: largura, altura, quantidade
   - Cálculo automático de área total
   - Preço baseado em área (R$/m²)

2. **SIMPLE_UNIT** (Produtos por unidade):
   - Campos específicos: tamanho do papel, tipo de papel, cores de impressão, acabamento
   - Suporte a tamanhos personalizados
   - Oculta campos de dimensões (usa 1x1mm internamente)
   - Preço fixo por unidade

3. **DYNAMIC_ENGINEER** (Produtos dinâmicos):
   - Campos: tempo de máquina, tempo de setup, complexidade
   - Cálculo baseado em tempo e complexidade
   - Preço calculado dinamicamente

### Backend (Node.js/TypeScript/Prisma)

#### 1. **Casos de Uso (Use Cases)**

##### CreateOrderUseCase
- **Localização**: `backend/src/modules/sales/application/use-cases/CreateOrderUseCase.ts`
- **Responsabilidades**:
  - Validação de cliente e produtos
  - Geração automática de número do pedido
  - Cálculo de validade do orçamento (configurável por organização)
  - Integração com PricingEngine para cálculo de preços
  - Criação de itens com preços calculados (custo, sugerido, praticado)

##### UpdateOrderUseCase
- **Localização**: `backend/src/modules/sales/application/use-cases/UpdateOrderUseCase.ts`
- **Responsabilidades**:
  - Validação de permissão de edição (apenas pedidos em status DRAFT podem ser editados)
  - Atualização de itens e recálculo de totais
  - Manutenção da integridade dos dados

**Regras de Edição**:
- Apenas pedidos com status `DRAFT` (Rascunho) podem ser editados
- Pedidos aprovados, em produção, finalizados, entregues ou cancelados são somente leitura
- A validação ocorre tanto no frontend quanto no backend para garantir consistência

#### 2. **Modelo de Dados (Database Schema)**

##### Tabela Order
```sql
model Order {
  id             String      @id @default(uuid())
  organizationId String
  customerId     String
  orderNumber    String      // Número sequencial único
  status         OrderStatus @default(DRAFT)
  
  // Valores financeiros
  subtotal       Decimal     @db.Decimal(10,2)
  discount       Decimal     @default(0) @db.Decimal(10,2)
  tax            Decimal     @default(0) @db.Decimal(10,2)
  total          Decimal     @db.Decimal(10,2)
  
  // Prazos
  deliveryDate   DateTime?
  validUntil     DateTime?   // Validade do orçamento
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt
  
  notes          String?
  items          OrderItem[]
}
```

##### Tabela OrderItem
```sql
model OrderItem {
  id              String  @id @default(uuid())
  orderId         String
  productId       String
  
  // Especificações básicas
  width           Float   // mm
  height          Float   // mm
  quantity        Int
  
  // Campos específicos por tipo
  area            Float?  // Para produtos por m²
  paperSize       String? // Para impressão
  paperType       String?
  printColors     String?
  finishing       String?
  customSizeName  String? // Tamanhos personalizados
  isCustomSize    Boolean @default(false)
  machineTime     Float?  // Para produtos dinâmicos
  setupTime       Float?
  complexity      String?
  
  // Tríade de preços
  costPrice       Decimal @db.Decimal(10,2) // Custo interno
  calculatedPrice Decimal @db.Decimal(10,2) // Preço sugerido
  unitPrice       Decimal @db.Decimal(10,2) // Preço praticado
  totalPrice      Decimal @db.Decimal(10,2)
  
  notes           String?
}
```

#### 3. **Status do Pedido (OrderStatus)**
- **DRAFT**: Rascunho/Orçamento - **ÚNICO STATUS QUE PERMITE EDIÇÃO**
- **APPROVED**: Aprovado pelo cliente - inicia produção (somente leitura)
- **IN_PRODUCTION**: Em produção - não pode ser cancelado (somente leitura)
- **FINISHED**: Produção finalizada - pronto para entrega (somente leitura)
- **DELIVERED**: Entregue ao cliente - processo completo (somente leitura)
- **CANCELLED**: Cancelado - processo interrompido (somente leitura)

**Regras de Transição**:
- DRAFT → APPROVED ou CANCELLED
- APPROVED → IN_PRODUCTION ou CANCELLED  
- IN_PRODUCTION → FINISHED ou CANCELLED
- FINISHED → DELIVERED
- DELIVERED → (estado final)
- CANCELLED → (estado final)

#### 4. **API Endpoints**
- `POST /api/sales/orders` - Criar pedido
- `GET /api/sales/orders` - Listar pedidos com filtros
- `GET /api/sales/orders/stats` - Estatísticas dos pedidos
- `GET /api/sales/orders/:id` - Buscar pedido específico
- `PUT /api/sales/orders/:id` - Atualizar pedido (apenas DRAFT)
- `PATCH /api/sales/orders/:id/status` - Atualizar status
- `POST /api/sales/simulate` - Simular preço de item

## Regras de Edição de Pedidos

### Validação de Status para Edição

O sistema implementa validação rigorosa para edição de pedidos baseada no status atual:

**✅ PODE SER EDITADO:**
- **DRAFT** (Rascunho): Único status que permite edição completa
  - Pode alterar cliente, itens, quantidades, preços
  - Pode adicionar/remover itens
  - Pode modificar especificações técnicas
  - Pode alterar observações e data de entrega

**❌ NÃO PODE SER EDITADO:**
- **APPROVED** (Aprovado): Pedido aprovado pelo cliente
- **IN_PRODUCTION** (Em Produção): Já iniciou a produção
- **FINISHED** (Finalizado): Produção concluída
- **DELIVERED** (Entregue): Processo completo
- **CANCELLED** (Cancelado): Pedido cancelado

### Implementação da Validação

**Frontend (CriarPedido.tsx)**:
```typescript
// Verificar se o pedido pode ser editado
if (pedido.status !== 'DRAFT') {
  toast.error('Apenas pedidos em rascunho podem ser editados');
  navigate('/pedidos');
  return;
}
```

**Backend (UpdateOrderUseCase.ts)**:
```typescript
// Verificar se o pedido pode ser editado (apenas DRAFT)
if (existingOrder.status.value !== 'DRAFT') {
  throw new ValidationError('Apenas pedidos em rascunho podem ser editados');
}
```

**Domain Entity (Order.ts)**:
```typescript
canBeModified(): boolean {
  return this._status.isDraft();
}
```

### Interface do Usuário

- Botão "Editar" só aparece para pedidos com status DRAFT
- Pedidos com outros status mostram apenas visualização
- Mensagem clara quando usuário tenta editar pedido não editável
- Redirecionamento automático para lista de pedidos em caso de tentativa inválida

## Funcionalidades Implementadas

### ✅ Funcionalidades Completas

1. **Gestão Completa de Pedidos**
   - Criação, edição, listagem e visualização
   - Suporte a três tipos de produtos diferentes
   - Cálculo automático de preços e materiais
   - Validação robusta de dados

2. **Interface de Cliente Otimizada**
   - Busca inteligente de clientes
   - Seleção com ocultação do campo após escolha
   - Botões de ação (trocar cliente, dados de faturamento)

3. **Sistema de Itens Flexível**
   - Formulário dinâmico baseado no tipo de produto
   - Suporte a tamanhos personalizados
   - Integração com MaterialCalculator
   - Campos específicos por categoria de produto

4. **Dashboard e Estatísticas**
   - KPIs em tempo real (total, valor, crescimento)
   - Filtros avançados e ordenação
   - Visualização em lista e kanban
   - Identificação de pedidos vencidos

5. **Comunicação Automatizada**
   - Integração WhatsApp para notificações
   - Mensagens automáticas por mudança de status
   - Mensagens personalizadas
   - Lembretes para orçamentos vencidos

6. **Análise Financeira**
   - Cálculo de margem e rentabilidade
   - Controle de acesso por perfil de usuário
   - Tríade de preços (custo, sugerido, praticado)
   - Análise de custos de materiais

7. **Automação de Processos**
   - Ações em lote para múltiplos pedidos
   - Regras de automação configuráveis
   - Timeline de produção visual
   - Notificações automáticas

8. **Gestão de Status Avançada**
   - Workflow completo de produção com transições controladas
   - Validações rigorosas: apenas pedidos DRAFT podem ser editados
   - Histórico de mudanças de status
   - Controles de permissão por papel do usuário
   - Botões de edição condicionais baseados no status

## Funcionalidades Pendentes para Desenvolvimento

### 🔄 Em Desenvolvimento / Melhorias Necessárias

1. **Sistema de Aprovação de Orçamentos**
   - Interface para cliente aprovar orçamentos online
   - Assinatura digital de contratos
   - Portal do cliente para acompanhamento
   - Notificações de aprovação/rejeição

2. **Gestão de Produção Avançada**
   - Planejamento de produção por máquina
   - Controle de capacidade produtiva
   - Sequenciamento otimizado de ordens
   - Integração com equipamentos (IoT)

3. **Sistema de Entregas**
   - Agendamento de entregas
   - Rastreamento de entregadores
   - Integração com transportadoras
   - Confirmação de recebimento

4. **Relatórios e Analytics**
   - Relatórios de produtividade
   - Análise de rentabilidade por produto
   - Previsão de demanda
   - Dashboard executivo

5. **Integração Financeira**
   - Geração automática de faturas
   - Integração com sistemas contábeis
   - Controle de contas a receber
   - Fluxo de caixa projetado

6. **Sistema de Qualidade**
   - Controle de qualidade por etapa
   - Registro de não conformidades
   - Ações corretivas
   - Certificações de qualidade

### 🚀 Funcionalidades Futuras (Roadmap)

1. **Inteligência Artificial**
   - Precificação inteligente baseada em histórico
   - Previsão de prazos de entrega
   - Otimização automática de layouts
   - Detecção de padrões de consumo

2. **Integração com E-commerce**
   - Catálogo online para clientes
   - Pedidos via website
   - Calculadora de preços online
   - Sistema de pagamento integrado

3. **Mobile App**
   - App para acompanhamento de pedidos
   - Notificações push
   - Aprovação de orçamentos mobile
   - Scanner de códigos de barras

4. **Gestão de Estoque Avançada**
   - Reposição automática de materiais
   - Integração com fornecedores
   - Controle de lotes e validades
   - Otimização de compras

5. **Sistema de CRM**
   - Histórico completo do cliente
   - Campanhas de marketing
   - Análise de comportamento
   - Programa de fidelidade

## Arquitetura Técnica

### Padrões Utilizados

1. **Domain-Driven Design (DDD)**
   - Separação clara entre domínio e infraestrutura
   - Use Cases para regras de negócio
   - Value Objects para conceitos do domínio
   - Repositories para persistência

2. **Clean Architecture**
   - Camadas bem definidas
   - Inversão de dependências
   - Testabilidade alta
   - Baixo acoplamento

3. **CQRS (Command Query Responsibility Segregation)**
   - Separação entre comandos e consultas
   - Otimização específica por operação
   - Escalabilidade independente

### Tecnologias

**Frontend**:
- React 18 com TypeScript
- Tailwind CSS para estilização
- Lucide React para ícones
- React Router para navegação
- Sonner para notificações

**Backend**:
- Node.js com TypeScript
- Fastify como framework web
- Prisma como ORM
- PostgreSQL como banco de dados
- JWT para autenticação

**Integrações**:
- WhatsApp Business API
- Sistema de materiais próprio
- PricingEngine customizado

## Fluxo de Trabalho Típico

### 1. Criação de Pedido
1. Usuário acessa "Criar Novo Pedido"
2. Seleciona cliente (busca inteligente)
3. Adiciona itens um por um:
   - Seleciona produto
   - Define especificações (varia por tipo)
   - Sistema calcula preço automaticamente
   - Usuário pode ajustar preço manualmente
4. Revisa totais e informações
5. Salva como rascunho ou finaliza

### 2. Aprovação e Produção
1. Cliente recebe orçamento via WhatsApp/Email
2. Cliente aprova (manual ou via sistema)
3. Status muda para APPROVED
4. Pedido entra na fila de produção
5. Produção inicia (IN_PRODUCTION)
6. Produção finaliza (FINISHED)
7. Produto é entregue (DELIVERED)

### 3. Acompanhamento
1. Dashboard mostra status em tempo real
2. Notificações automáticas por mudança
3. Cliente pode acompanhar progresso
4. Relatórios de performance disponíveis

## Considerações de Performance

### Otimizações Implementadas
- Lazy loading de componentes pesados
- Paginação de listas grandes
- Cache de consultas frequentes
- Debounce em campos de busca
- Memoização de cálculos complexos

### Monitoramento
- Logs estruturados de operações
- Métricas de performance de API
- Alertas para operações lentas
- Dashboard de saúde do sistema

## Segurança

### Controles Implementados
- Autenticação JWT obrigatória
- Autorização baseada em roles
- Validação de dados de entrada
- Sanitização de queries
- Controle de acesso por organização

### Auditoria
- Log de todas as operações
- Rastreamento de mudanças
- Histórico de status
- Backup automático de dados

## Conclusão

O módulo de pedidos representa uma solução completa e robusta para gestão de ordens de serviço em gráficas e empresas similares. Com arquitetura moderna, interface intuitiva e funcionalidades avançadas, o sistema atende desde pequenas operações até empresas de grande porte.

A implementação atual cobre todos os aspectos essenciais do processo, desde a criação até a entrega, com automação inteligente e análise financeira detalhada. As funcionalidades pendentes representam oportunidades de evolução para tornar o sistema ainda mais competitivo e eficiente.

O design modular e a arquitetura limpa facilitam a manutenção e evolução contínua do sistema, garantindo que novas funcionalidades possam ser adicionadas sem comprometer a estabilidade existente.