# ArtPlim ERP - Guia Detalhado do Sistema

O **ArtPlim ERP** é uma plataforma robusta de gestão (ERP) e automação projetada especificamente para o setor de **comunicação visual e gráficas**. O sistema utiliza uma arquitetura moderna, escalável e multi-tenant.

---

## 🏛️ Arquitetura e Estrutura do Projeto

### Hierarquia de Pastas (Raiz)
- **`backend/`**: API REST construída com Fastify e Node.js. Utiliza Prisma como ORM.
  - `prisma/`: Schema do banco de dados e migrações.
  - `src/modules/`: Lógica de negócio separada por domínio.
  - `src/shared/`: Middlewares, utilitários e erros globais.
- **`frontend/`**: Aplicação React Single Page (Vite).
  - `src/pages/`: Telas principais do sistema.
  - `src/components/`: Componentes UI reutilizáveis (baseados em Shadcn/Radix).
  - `src/hooks/`: Lógica compartilhada de estado e WebSockets.
- **`docs/`**: Repositório de documentação técnica, histórico de correções e guias de uso.
- **`scripts/`**: Utilitários de manutenção, seeds de banco de dados e testes de performance.

---

## ⚙️ Módulos do Sistema (Backend)

Cada módulo em `backend/src/modules/` opera de forma isolada, comunicando-se via banco de dados:

1.  **Auth (Autenticação)**:
    - Login multi-tenant (validação por organização).
    - Tokens JWT e RBAC (Controle de Acesso Baseado em Roles: Admin, Gerente, Produção, Vendedor).
2.  **Catalog (Catálogo e Precificação)**:
    - **Produtos**: Itens vendíveis com dimensões (área), unidades ou fórmulas.
    - **Regras de Precificação**: Motor dinâmico que avalia fórmulas JSON complexas. Suporta versionamento automático para garantir que pedidos antigos mantenham o preço original mesmo se a regra mudar.
3.  **Sales (Vendas)**:
    - **Orçamentos**: Criação de cotações rápidas com cálculo automático.
    - **Pedidos**: Conversão de orçamentos em ordens firmes, geração de histórico de status.
4.  **Production (Produção)**:
    - **Fila de Produção**: Gestão de itens que entram na fábrica.
    - **Solicitações de Alteração**: Sistema de aprovação para mudanças em pedidos que já iniciaram a produção, garantindo integridade financeira e produtiva.
5.  **Finance (Financeiro)**:
    - Fluxo de caixa, integração com pedidos, métodos de pagamento e conciliação bancária.
6.  **WMS (Gestão de Inventário)**:
    - Rastreamento de materiais brutos e sobras (offcuts).
    - Alertas de nível crítico usando thresholds configuráveis por material.

---

## 🖥️ Guia de Telas (Frontend)

- **Dashboard**: Painel dinâmico com gráficos de vendas, Ticket Médio e status de produção em tempo real.
- **Pedidos**: Lista central de vendas. Inclui filtros por status, cliente e data. Permite visualizar o histórico completo de quem moveu o pedido em cada fase.
- **Produção (Kanban)**: Quadro visual onde os itens de produção são movidos entre colunas (ex: Arte, Impressão, Acabamento, Expedição). Utiliza **WebSockets** para atualizações instantâneas entre todos os usuários logados.
- **Produtos**: Gestão do catálogo. Inclui o **Editor de Fórmulas**, onde é possível configurar como cada item é calculado (markup, custos de material, operação de máquina).
- **Clientes (CRM)**: Cadastro unificado de perfis. Um perfil pode ser simultaneamente Cliente e Fornecedor.
- **Configurações**: Painel do administrador para ativar/desativar módulos (ex: "Usar WMS", "Habilitar Automação") e configurar dados da empresa.

---

## 🔄 Fluxo de Trabalho Típico (Business Workflow)

1.  **Orçamento**: Vendedor cria um orçamento -> O sistema calcula o preço usando as **Regras de Precificação** -> Cliente aprova.
2.  **Conversão**: O orçamento vira um **Pedido** -> O financeiro confirma o recebimento/condição.
3.  **Produção**: O pedido gera itens na **Fila de Produção** -> Os operadores movem os itens no **Kanban**.
4.  **Alteração (Opcional)**: Se o cliente mudar a medida, o sistema gera uma **Solicitação de Alteração** -> O gerente aprova -> O preço e a produção são atualizados automaticamente.
5.  **Finalização**: O item é marcado como entregue -> Status migra para Finalizado -> Baixa automática no estoque via módulos **Inventory**.

---

## 📊 Estrutura de Dados (Prisma Deep Dive)

- **Organização (Tenant)**: O coração do sistema. Todas as tabelas possuem `organizationId`.
- **Profiles**: Entidade genérica para pessoas/empresas. Atributos booleanos determinam o papel (`isCustomer`, `isSupplier`, `isEmployee`).
- **Standard Sizes / Materials**: Tabelas de apoio que alimentam o motor de cálculo, permitindo padronização de medidas e custos de insumos.
- **InventoryMovements**: Registro auditável de toda entrada e saída de estoque.

---

## 🚀 Como Executar

Consulte as instruções simplificadas no [README principal](./README.md) ou use `pnpm run dev` na raiz para iniciar todo o ecossistema.