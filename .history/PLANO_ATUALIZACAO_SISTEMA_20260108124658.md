# Plano de Atualização do Sistema ERP - ArtPlimERP

**Versão:** 2.1  
**Data:** Janeiro 2026  
**Status:** Planejamento  

---

## 1. Visão Geral do Plano

Este plano de atualização visa evoluir o sistema ERP ArtPlimERP da versão atual (2.0) para a versão 2.1, focando em completar funcionalidades pendentes, corrigir inconsistências identificadas e implementar melhorias de performance e usabilidade.

### 1.1 Objetivos Principais

- **Completar Sistema de Configurações Dinâmicas de Produtos**
- **Implementar Sistema de Handshake para Produção**
- **Corrigir Regras de Edição de Pedidos**
- **Desenvolver Relatórios e Analytics**
- **Melhorar Performance e Experiência do Usuário**

---

## 2. Análise do Estado Atual

### 2.1 Funcionalidades Implementadas ✅

**Sistema de Produtos e Materiais:**
- Cadastro de produtos com três modos de precificação
- Sistema de materiais com formatos (SHEET, ROLL, UNIT)
- ProductComponentManager para vincular materiais
- Cálculo automático de custos baseado em materiais
- Sistema de perdas em unidades com prioridade sobre percentuais
- Interface de configuração com abas

**Sistema de Pedidos:**
- Criação e edição de pedidos com interface dinâmica
- MaterialCalculator integrado para cálculo em tempo real
- Gestão de status com regras flexíveis
- Interface otimizada para seleção de clientes
- Suporte a produtos por unidade

### 2.2 Funcionalidades Pendentes 🔄

**Críticas (Bloqueiam operação):**
- Correção das regras de edição de pedidos (apenas DELIVERED deve ser imutável)
- Sistema de configurações dinâmicas de produtos

**Importantes (Impactam produtividade):**
- Sistema de handshake para produção
- Relatórios de custos e margens
- Notificações WebSocket

**Desejáveis (Melhoram experiência):**
- Dashboard de performance
- Automação de processos
- Integração com módulo financeiro

---

## 3. Fases de Implementação

### **FASE 1: Correções Críticas** 
*Duração: 1-2 semanas*  
*Prioridade: ALTA*

#### 3.1.1 Correção das Regras de Edição de Pedidos

**Problema Identificado:**
- Sistema atualmente permite edição apenas em status DRAFT
- Documentação indica que todos os status devem permitir edição, exceto DELIVERED

**Tarefas:**
- [ ] **1.1** Atualizar `UpdateOrderUseCase.ts` no backend
  - Alterar validação de `status !== 'DRAFT'` para `status === 'DELIVERED'`
  - Testar todas as transições de status
  - **Arquivo:** `backend/src/modules/sales/application/use-cases/UpdateOrderUseCase.ts`

- [ ] **1.2** Atualizar validação no frontend
  - Corrigir `CriarPedido.tsx` para permitir edição em todos os status exceto DELIVERED
  - Atualizar interface de botões de edição
  - **Arquivo:** `frontend/src/pages/CriarPedido.tsx`

- [ ] **1.3** Atualizar entidade de domínio
  - Corrigir método `canBeModified()` na entidade Order
  - **Arquivo:** `backend/src/modules/sales/domain/entities/Order.ts`

- [ ] **1.4** Testes de validação
  - Criar testes para todas as combinações de status
  - Validar comportamento em produção

**Critérios de Aceite:**
- Pedidos em DRAFT, APPROVED, IN_PRODUCTION, FINISHED, CANCELLED podem ser editados
- Apenas pedidos DELIVERED são imutáveis
- Interface reflete corretamente as permissões

#### 3.1.2 Correção de Bugs Identificados

**Tarefas:**
- [ ] **1.5** Corrigir erro de sintaxe no `Produtos.tsx`
  - Resolver problemas de JSX identificados nos diagnósticos
  - **Arquivo:** `frontend/src/pages/Produtos.tsx`

- [ ] **1.6** Validar integração MaterialCalculator
  - Garantir que não há fallback para dados mock
  - Testar cálculos com dados reais

### **FASE 2: Sistema de Configurações Dinâmicas**
*Duração: 2-3 semanas*  
*Prioridade: ALTA*

#### 3.2.1 Completar ProductConfigurationManager

**Objetivo:** Permitir criação de variações de produto (páginas, acabamentos, etc.)

**Tarefas:**
- [ ] **2.1** Implementar interface de configurações
  - Completar `ProductConfigurationManager.tsx`
  - Criar formulários para adicionar opções configuráveis
  - **Arquivo:** `frontend/src/components/catalog/ProductConfigurationManager.tsx`

- [ ] **2.2** Desenvolver backend para configurações
  - Implementar APIs para gerenciar configurações de produto
  - Criar validações de negócio
  - **Arquivo:** `backend/src/modules/catalog/services/ProductConfigurationService.ts`

- [ ] **2.3** Integrar com sistema de pedidos
  - Atualizar `AddItemForm.tsx` para suportar configurações dinâmicas
  - Implementar cálculo de preços baseado em configurações
  - **Arquivo:** `frontend/src/components/pedidos/AddItemForm.tsx`

**Exemplo de Uso:**
```
Produto: "Cardápio"
Configurações:
- Páginas: 2, 4, 6, 8
- Acabamento: Laminação, Verniz UV
- Encadernação: Espiral, Grampo
```

#### 3.2.2 Sistema de Variações de Produto

**Tarefas:**
- [ ] **2.4** Criar interface para definir variações
  - Modal para adicionar/editar variações
  - Validação de combinações válidas

- [ ] **2.5** Implementar cálculo automático
  - Calcular materiais necessários por variação
  - Integrar com sistema de perdas

### **FASE 3: Sistema de Handshake para Produção**
*Duração: 2-3 semanas*  
*Prioridade: MÉDIA*

#### 3.3.1 Implementar Notificações WebSocket

**Objetivo:** Comunicação em tempo real entre vendas e produção

**Tarefas:**
- [ ] **3.1** Configurar WebSocket no backend
  - Implementar servidor WebSocket
  - Criar sistema de salas por organização
  - **Arquivo:** `backend/src/shared/infrastructure/websocket/`

- [ ] **3.2** Implementar cliente WebSocket no frontend
  - Conectar interface de produção
  - Criar componente de notificações
  - **Arquivo:** `frontend/src/hooks/useWebSocket.ts`

#### 3.3.2 Interface de Aprovação para Operadores

**Tarefas:**
- [ ] **3.3** Criar painel de produção
  - Interface para visualizar solicitações de alteração
  - Botões de aprovar/rejeitar alterações
  - **Arquivo:** `frontend/src/pages/Producao.tsx`

- [ ] **3.4** Implementar fluxo de handshake
  - Salvar alterações em `pendingChanges`
  - Notificar operadores via WebSocket
  - Aplicar alterações após aprovação

**Fluxo do Handshake:**
1. Vendedor tenta alterar pedido em produção
2. Sistema salva em `pendingChanges`
3. Notificação enviada para produção
4. Operador aprova/rejeita
5. Sistema aplica ou descarta alterações

### **FASE 4: Relatórios e Analytics**
*Duração: 3-4 semanas*  
*Prioridade: MÉDIA*

#### 3.4.1 Dashboard de Performance

**Tarefas:**
- [ ] **4.1** Criar dashboard executivo
  - KPIs de vendas e produção
  - Gráficos de performance
  - **Arquivo:** `frontend/src/pages/Dashboard.tsx`

- [ ] **4.2** Relatórios de custos e margens
  - Análise de rentabilidade por produto
  - Comparação custo real vs estimado
  - **Arquivo:** `frontend/src/pages/Relatorios.tsx`

#### 3.4.2 Analytics de Materiais

**Tarefas:**
- [ ] **4.3** Análise de perdas por material
  - Tracking de perdas reais vs estimadas
  - Sugestões de otimização
  - **Arquivo:** `backend/src/modules/analytics/`

- [ ] **4.4** Previsão de demanda
  - Análise de padrões de consumo
  - Alertas de reposição de estoque

### **FASE 5: Melhorias de Performance e UX**
*Duração: 2-3 semanas*  
*Prioridade: BAIXA*

#### 3.5.1 Otimizações de Performance

**Tarefas:**
- [ ] **5.1** Implementar cache Redis
  - Cache de consultas frequentes
  - Cache de cálculos de materiais
  - **Arquivo:** `backend/src/shared/infrastructure/cache/`

- [ ] **5.2** Otimizar queries do banco
  - Adicionar índices necessários
  - Otimizar includes do Prisma

#### 3.5.2 Melhorias de Interface

**Tarefas:**
- [ ] **5.3** Implementar lazy loading
  - Componentes pesados carregados sob demanda
  - Paginação inteligente

- [ ] **5.4** Melhorar feedback visual
  - Loading states mais informativos
  - Animações de transição

---

## 4. Cronograma Detalhado

### Semana 1-2: Fase 1 (Correções Críticas)
- **Semana 1:** Correção das regras de edição de pedidos
- **Semana 2:** Correção de bugs e testes

### Semana 3-5: Fase 2 (Configurações Dinâmicas)
- **Semana 3:** Interface de configurações
- **Semana 4:** Backend e APIs
- **Semana 5:** Integração com pedidos

### Semana 6-8: Fase 3 (Sistema de Handshake)
- **Semana 6:** WebSocket e notificações
- **Semana 7:** Interface de produção
- **Semana 8:** Testes e refinamentos

### Semana 9-12: Fase 4 (Relatórios e Analytics)
- **Semana 9-10:** Dashboard e relatórios básicos
- **Semana 11-12:** Analytics avançados

### Semana 13-15: Fase 5 (Performance e UX)
- **Semana 13-14:** Otimizações de performance
- **Semana 15:** Melhorias de interface

---

## 5. Recursos Necessários

### 5.1 Equipe Técnica

**Desenvolvedor Full-Stack (1):**
- Responsável por implementação completa
- Conhecimento em React, TypeScript, Node.js, Prisma

**Tester/QA (0.5):**
- Testes de funcionalidade e regressão
- Validação de regras de negócio

### 5.2 Infraestrutura

**Desenvolvimento:**
- Ambiente de desenvolvimento isolado
- Base de dados de teste com dados realistas

**Produção:**
- Servidor Redis para cache
- Monitoramento de performance

---

## 6. Riscos e Mitigações

### 6.1 Riscos Técnicos

**Risco:** Quebra de funcionalidades existentes durante correções
**Mitigação:** Testes automatizados abrangentes antes de cada deploy

**Risco:** Performance degradada com novas funcionalidades
**Mitigação:** Monitoramento contínuo e otimizações proativas

### 6.2 Riscos de Negócio

**Risco:** Resistência dos usuários a mudanças na interface
**Mitigação:** Treinamento e documentação detalhada

**Risco:** Interrupção das operações durante atualizações
**Mitigação:** Deploy em horários de baixo movimento, rollback preparado

---

## 7. Critérios de Sucesso

### 7.1 Métricas Técnicas

- **Performance:** Tempo de resposta < 200ms para 95% das requisições
- **Disponibilidade:** Uptime > 99.5%
- **Cobertura de Testes:** > 80% para código crítico

### 7.2 Métricas de Negócio

- **Produtividade:** Redução de 30% no tempo de criação de pedidos
- **Precisão:** Redução de 50% em erros de cálculo de materiais
- **Satisfação:** Score > 4.5/5 em pesquisa de usuários

---

## 8. Plano de Deploy

### 8.1 Estratégia de Versionamento

**Versão 2.1.0:** Release principal com todas as funcionalidades
**Versão 2.1.x:** Patches e correções menores

### 8.2 Processo de Deploy

1. **Deploy em Staging:** Validação completa em ambiente de teste
2. **Deploy Gradual:** Liberação por módulos em produção
3. **Monitoramento:** Acompanhamento intensivo nas primeiras 48h
4. **Rollback:** Plano de reversão em caso de problemas críticos

---

## 9. Documentação e Treinamento

### 9.1 Documentação Técnica

- [ ] Atualizar documentação de APIs
- [ ] Criar guias de configuração para novas funcionalidades
- [ ] Documentar fluxos de handshake e notificações

### 9.2 Treinamento de Usuários

- [ ] Manual de usuário atualizado
- [ ] Vídeos tutoriais para novas funcionalidades
- [ ] Sessões de treinamento para equipes

---

## 10. Próximos Passos Imediatos

### Semana Atual
1. **Aprovação do plano** pela equipe de gestão
2. **Setup do ambiente** de desenvolvimento para as correções
3. **Início da Fase 1** - Correção das regras de edição de pedidos

### Preparação
- [ ] Backup completo do banco de dados atual
- [ ] Configuração de ambiente de teste
- [ ] Preparação de scripts de migração

---

## Conclusão

Este plano de atualização visa transformar o ArtPlimERP em uma solução ainda mais robusta e flexível, corrigindo as inconsistências identificadas e implementando funcionalidades que aumentarão significativamente a produtividade e precisão das operações.

A execução faseada permite minimizar riscos enquanto entrega valor incremental aos usuários. O foco inicial nas correções críticas garante que o sistema funcione conforme especificado, enquanto as fases subsequentes adicionam funcionalidades que diferenciam o produto no mercado.

**Data de Início Prevista:** Imediata  
**Data de Conclusão Prevista:** 15 semanas (aproximadamente 4 meses)  
**Investimento Estimado:** Médio (principalmente tempo de desenvolvimento)  
**ROI Esperado:** Alto (aumento de produtividade e redução de erros)