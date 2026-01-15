# ArtPlim ERP - Sistema de Gestão para Gráficas

Sistema ERP completo desenvolvido especificamente para gráficas, com foco em precificação inteligente, controle de estoque e gestão de produção.

## 🚀 Características Principais

### Multi-tenant
- Suporte a múltiplas empresas em uma única instalação
- Isolamento completo de dados por organização
- Planos flexíveis (Basic, Pro, Enterprise)

### Precificação Inteligente
- **Modo Simples**: Preço por m² ou unidade
- **Modo Engenharia**: Cálculo dinâmico baseado em custo + margem
- Motor de cálculo considerando materiais, operações e perdas técnicas

### Gestão Completa
- **Clientes**: Cadastro de pessoas físicas e jurídicas
- **Produtos**: Catálogo com receitas e componentes
- **Materiais**: Controle de matérias-primas (rolos, chapas, unidades)
- **Orçamentos**: Simulador de preços em tempo real
- **Pedidos**: Gestão completa do ciclo de vendas
- **Estoque**: Controle inteligente com otimização de retalhos

## 🛠️ Tecnologias

### Backend
- **Fastify**: Framework web rápido e eficiente
- **Prisma**: ORM moderno com TypeScript
- **PostgreSQL**: Banco de dados robusto
- **JWT**: Autenticação segura
- **Zod**: Validação de dados

### Frontend
- **React 18**: Interface moderna e responsiva
- **TypeScript**: Tipagem estática
- **Tailwind CSS**: Estilização utilitária
- **React Router**: Roteamento SPA
- **Axios**: Cliente HTTP

### Infraestrutura
- **Docker**: Containerização completa
- **Docker Compose**: Orquestração de serviços
- **Redis**: Cache e filas (futuro)

## 📦 Instalação

### Pré-requisitos
- Node.js 18+
- Docker e Docker Compose
- Git

### 1. Clone o repositório
```bash
git clone <repository-url>
cd artplim-erp
```

### 2. Configuração com Docker (Recomendado)
```bash
# Subir todos os serviços
docker-compose up -d

# Executar migrações do banco
docker-compose exec backend npx prisma db push

# Acessar a aplicação
# Frontend: http://localhost:3000
# Backend: http://localhost:3001
```

### 3. Instalação Manual

#### Backend
```bash
cd backend
npm install
cp .env.example .env
# Edite o .env com suas configurações
npx prisma db push
npm run dev
```

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

## 🗄️ Estrutura do Banco de Dados

### Principais Entidades
- **Organization**: Empresas (multi-tenant)
- **User**: Usuários do sistema
- **Profile**: Clientes, fornecedores e funcionários
- **Product**: Catálogo de produtos
- **Material**: Matérias-primas
- **Order**: Pedidos e orçamentos
- **InventoryItem**: Controle de estoque

### Recursos Avançados
- Auditoria completa (AuditLog)
- Configurações por organização
- Precificação flexível (simples ou dinâmica)
- Controle de componentes e operações

## 🎯 Funcionalidades

### ✅ Implementado
- [x] Autenticação multi-tenant
- [x] Cadastro de clientes e funcionários
- [x] Catálogo de produtos e materiais
- [x] Simulador de preços
- [x] Gestão de pedidos
- [x] Página de configurações
- [x] Relatórios básicos
- [x] Interface responsiva
- [x] Layout fixo (sidebar + topbar)

### 🚧 Em Desenvolvimento
- [ ] Controle de estoque avançado
- [ ] Módulo de produção (Kanban)
- [ ] Integração com n8n
- [ ] Geração de PDF
- [ ] Módulo financeiro
- [ ] Gerenciamento completo de usuários

### 📋 Roadmap
- [ ] App mobile (React Native)
- [ ] API para integrações
- [ ] Módulo de logística
- [ ] BI e analytics
- [ ] Automações avançadas

## 🔧 Configuração

### Variáveis de Ambiente

#### Backend (.env)
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/artplim_erp"
JWT_SECRET="your-super-secret-jwt-key"
PORT=3001
NODE_ENV=development
FRONTEND_URL="http://localhost:3000"
```

#### Frontend (.env)
```env
VITE_API_URL="http://localhost:3001"
```

## 📚 Uso

### 1. Primeiro Acesso
1. Acesse http://localhost:3000
2. Clique em "Registre-se"
3. Crie sua organização e usuário administrador
4. Faça login com as credenciais criadas

### 2. Configuração Inicial
1. Cadastre materiais básicos (lona, vinil, ACM, etc.)
2. Crie produtos no catálogo
3. Configure preços (simples ou dinâmico)
4. Cadastre seus primeiros clientes

### 3. Simulação de Preços
1. Acesse "Orçamentos"
2. Use o simulador de preços
3. Configure dimensões e quantidade
4. Veja o cálculo detalhado

## 🏗️ Arquitetura

### Backend (Monólito Modular)
```
src/
├── @core/           # Infraestrutura compartilhada
│   ├── database/    # Prisma client
│   ├── pricing-engine/ # Motor de cálculo
│   ├── errors/      # Tratamento de erros
│   └── middleware/  # Middlewares globais
├── modules/         # Módulos de negócio
│   ├── auth/        # Autenticação
│   ├── sales/       # Vendas e orçamentos
│   ├── catalog/     # Produtos e materiais
│   └── profiles/    # Clientes e fornecedores
└── shared/          # Utilitários globais
```

### Frontend (Component-Based)
```
src/
├── components/      # Componentes reutilizáveis
│   ├── ui/         # Componentes base
│   ├── layout/     # Layout (Sidebar, Topbar)
│   └── auth/       # Componentes de autenticação
├── pages/          # Páginas da aplicação
├── contexts/       # Contextos React
├── lib/            # Utilitários e configurações
└── hooks/          # Hooks customizados
```

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para detalhes.

## 📞 Suporte

- **Email**: suporte@artplim.com
- **Documentação**: [docs.artplim.com](https://docs.artplim.com)
- **Issues**: [GitHub Issues](https://github.com/artplim/erp/issues)

---

**ArtPlim ERP** - Transformando a gestão de gráficas com tecnologia moderna e inteligente. 🎨📊