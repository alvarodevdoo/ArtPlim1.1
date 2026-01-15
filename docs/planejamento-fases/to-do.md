🏗️ Arquitetura Multi-tenant (A Regra de Ouro)
Antes de qualquer página, definimos a estratégia de isolamento:

Estratégia: Shared Database, Separate Schemas (Conceitual) ou Column-based Isolation (Prático para SaaS modernos com Prisma).

Decisão: Vamos usar Column-based (organizationId) em todas as tabelas principais.

Segurança: Middleware no Prisma para injetar automaticamente o where: { organizationId: currentOrg } em todas as queries. Isso impede que o Cliente A veja dados do Cliente B.

📅 Sprint 0: A Fundação (Backend & Infra)
Objetivo: O sistema deve suportar múltiplas empresas e autenticação segura.

Modelagem de Dados (DB Engineering):

[ ] Criar tabela Organization (Nome, CNPJ, Slug, Plano).

[ ] Criar tabela User vinculada a Organization (Role: OWNER, ADMIN, USER).

[ ] Adicionar campo organizationId em TODAS as tabelas de negócio (Products, Profiles, Orders).

[ ] Adicionar índices compostos [organizationId, id] para performance.

Core do Backend (Fastify + Prisma):

[ ] Implementar Prisma Client Extension: Intercepta toda query para garantir que o tenant esteja filtrado.

[ ] Configurar JWT: O token deve carregar { userId, organizationId, role }.

[ ] Middleware Fastify: Extrair o tenant do Header/Token e injetar no contexto da request.

Auditoria (Auditor Requirement):

[ ] Criar tabela AuditLog (who, what, when, old_value, new_value, ip_address).

[ ] Middleware de Log: Registrar toda operação de escrita (POST, PUT, DELETE).

📅 Sprint 1: Cadastros Universais (Pessoas)
Objetivo: Gerenciar quem entra no sistema (Funcionários) e quem paga a conta (Clientes).

Backend (API):

[ ] Endpoint POST /profiles: Criação unificada (Transaction Service para separar tabelas de endereço/contato).

[ ] Endpoint GET /profiles: Listagem com filtros e paginação.

[ ] Regra de Negócio: Validação de CPF/CNPJ único dentro do tenant (ou global, decisão de negócio).

Frontend (Web Design Responsivo):

[ ] Pagina de Clientes:

Grid responsivo (Data Table) com busca rápida.

Formulário Wizard (Passo a passo) para dados cadastrais complexos.

[ ] Página de Funcionários:

Reutilizar o formulário de Clientes + Aba de "Contrato" e "Acesso ao Sistema".

UX Mobile: Botão flutuante para "Ligar" ou "WhatsApp" direto da lista no celular.

📅 Sprint 2: O Catálogo Inteligente (Produtos)
Objetivo: Suportar venda simples e engenharia de produto.

Backend:

[ ] CRUD de Materials (Matéria-prima: Custo, Estoque).

[ ] CRUD de Products com suporte a composição (Receita).

[ ] Lógica de Precificação: Endpoint para simular preço baseado na margem configurada.

Frontend:

[ ] Cadastro de Produtos:

Switch "Tipo de Precificação": Simples (Input R$) vs Dinâmico (Builder de Receita).

Upload de imagem do produto (integração Storage).

📅 Sprint 3: O Motor de Vendas (Orçamentos)
Objetivo: Transformar leads em dinheiro.

Backend:

[ ] Tabela Quote (Cabeçalho) e QuoteItem (Itens).

[ ] Motor de Cálculo: Ao adicionar item, recalcular totais, impostos e comissões.

[ ] Gerador de PDF: Criar proposta comercial em PDF baseada em HTML/Template.

Frontend:

[ ] Tela de Orçamento (POS):

Interface focada em velocidade (poucos cliques).

Busca de cliente type-ahead (autocompletar).

Visualização de margem de lucro em tempo real (visível apenas para gerente).

[ ] Botão "Aprovar": Transforma Orçamento em Ordem de Serviço.

📅 Sprint 4: Chão de Fábrica (Ordens de Serviço)
Objetivo: Execução e entrega.

Backend:

[ ] State Machine da OS: PENDENTE -> PRODUCAO -> ACABAMENTO -> EXPEDICAO -> ENTREGUE.

[ ] Baixa de Estoque: Ao mover para PRODUCAO, reservar materiais automaticamente.

Frontend:

[ ] Kanban de Produção:

Colunas arrastáveis (Drag & Drop) para mudar status da OS.

Cartões coloridos por prazo de entrega (Vermelho = Atrasado).

[ ] Página da OS (Impressão): Layout limpo para o operador saber o que produzir (sem valores financeiros).

🛠️ Implementação Técnica: O "Guardrail" do Multi-tenant
Como sênior, eu insisto que implementemos isso hoje. Aqui está o padrão de código para o src/@core/database/prisma.ts:

TypeScript

import { PrismaClient } from '@prisma/client';

// Função para criar um cliente Prisma "tenant-aware"
export function getTenantClient(organizationId: string) {
  const prisma = new PrismaClient();
  
  return prisma.$extends({
    query: {
      $allModels: {
        async findMany({ args, query }) {
          // Injeta obrigatoriamente o filtro de Tenant
          args.where = { ...args.where, organizationId };
          return query(args);
        },
        async create({ args, query }) {
          // Garante que tudo criado pertença ao Tenant atual
          (args.data as any).organizationId = organizationId;
          return query(args);
        },
        // Repetir para update, delete, findFirst, etc.
      },
    },
  });
}
📋 To-Do Imediato (Start do Projeto)
Inicializar Repo: Configurar Monorepo ou estrutura de pastas definida na documentação anterior.

Configurar Docker: PostgreSQL container local.

Schema Base: Criar schema.prisma com Organization, User e Product já com organizationId.

Prova de Conceito (PoC): Criar 2 organizações e provar que o Usuário A não vê produtos da Organização B.