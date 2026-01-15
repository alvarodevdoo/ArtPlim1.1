# Scripts de Teste de Performance - Guia de Uso

**Data:** 09 de Janeiro de 2026  
**Status:** ✅ DISPONÍVEL  

---

## 🚀 Scripts Disponíveis no Package.json da Raiz

Agora você pode executar todos os testes de performance diretamente da raiz do projeto usando os seguintes comandos:

### 📊 **Teste Completo de Performance**

```bash
# Comando principal - Teste completo do sistema
pnpm run test:performance

# Versão com mensagem explicativa
pnpm run test:performance:full
```

**O que testa:**
- ✅ Conexão PostgreSQL
- ✅ Conexão Redis (com fallback para memória)
- ✅ Endpoints da API
- ✅ Performance de queries otimizadas
- ✅ Performance do cache
- ✅ Testes de stress (50 queries simultâneas)
- ✅ Uso de memória
- ✅ Verificação de índices do banco

### 🔧 **Testes Específicos**

```bash
# Teste das melhorias da Fase 5
pnpm run test:phase5

# Teste dos endpoints de analytics
pnpm run test:analytics

# Verificação do banco de dados
pnpm run test:database

# Otimização do banco de dados
pnpm run optimize:database
```

---

## 📋 Exemplo de Uso

### 1. Teste Rápido de Performance

```bash
# Na raiz do projeto
pnpm run test:performance
```

**Saída esperada:**
```
🧪 INICIANDO TESTE COMPLETO DE PERFORMANCE DO SISTEMA
⏰ Timestamp: 2026-01-09T14:50:09.288Z
🖥️ Ambiente: development

🎯 RESUMO GERAL:
   Total de testes: 18
   ✅ Sucessos: 13
   ❌ Falhas: 5
   ⏱️ Tempo médio: 15ms
   📈 Taxa de sucesso: 72%

🏥 SAÚDE DOS COMPONENTES:
   ✅ PostgreSQL: Conexão estabelecida com sucesso (29ms)
   ✅ Redis: Backend: Redis, Conectado: true (3ms)
   ✅ Memory Usage: RSS: 321MB, Heap: 221MB
   ✅ Database Indexes: 21 índices otimizados encontrados
```

### 2. Teste com Explicação

```bash
# Versão com mensagem explicativa
pnpm run test:performance:full
```

### 3. Verificar Estado do Banco

```bash
# Verificar conexão e estrutura do banco
pnpm run test:database
```

---

## 🎯 Interpretação dos Resultados

### Status dos Componentes
- ✅ **Healthy**: Funcionando perfeitamente
- ⚠️ **Warning**: Performance degradada
- ❌ **Critical**: Problemas sérios

### Tempos de Resposta
- **<100ms**: 🚀 Performance excelente
- **100-500ms**: ⚡ Performance aceitável  
- **>500ms**: 🐌 Necessita otimização

### Taxa de Sucesso
- **>90%**: Sistema muito estável
- **70-90%**: Sistema estável com algumas falhas
- **<70%**: Sistema instável, investigação necessária

---

## 🔧 Pré-requisitos

### 1. Redis (Opcional)
```bash
# Iniciar Redis no Docker (porta 6380)
docker-compose -f docker-compose.redis-simple.yml up -d
```

### 2. Banco de Dados
```bash
# Certificar que o PostgreSQL está rodando
pnpm run db:push
```

### 3. Dependências
```bash
# Instalar dependências (se necessário)
pnpm run setup
```

---

## 📈 Quando Usar Cada Script

### `test:performance` - Use quando:
- ✅ Quiser validar performance geral do sistema
- ✅ Após fazer mudanças significativas
- ✅ Antes de fazer deploy
- ✅ Para monitoramento regular

### `test:phase5` - Use quando:
- ✅ Quiser testar especificamente as otimizações da Fase 5
- ✅ Validar cache e query optimizer
- ✅ Verificar melhorias implementadas

### `test:analytics` - Use quando:
- ✅ Testar endpoints de relatórios
- ✅ Validar dashboard de analytics
- ✅ Verificar performance de queries complexas

### `test:database` - Use quando:
- ✅ Verificar conexão com banco
- ✅ Validar estrutura de dados
- ✅ Diagnosticar problemas de conectividade

### `optimize:database` - Use quando:
- ✅ Quiser criar/atualizar índices otimizados
- ✅ Melhorar performance de queries
- ✅ Após mudanças no schema

---

## 🚨 Troubleshooting

### Erro: "Redis connection error"
```bash
# Iniciar Redis
docker-compose -f docker-compose.redis-simple.yml up -d

# Ou usar fallback para memória (automático)
```

### Erro: "Database connection failed"
```bash
# Verificar se PostgreSQL está rodando
pnpm run db:push

# Verificar variáveis de ambiente
cat backend/.env
```

### Erro: "API endpoints não disponíveis"
```bash
# Iniciar o backend
pnpm run dev:backend

# Em outro terminal, executar o teste
pnpm run test:performance
```

---

## 📊 Métricas de Referência

### Performance Excelente
- **Database Connection**: <50ms
- **Redis Connection**: <10ms
- **Query Performance**: <100ms
- **Cache Operations**: <20ms
- **Memory Usage**: <500MB RSS

### Performance Aceitável
- **Database Connection**: 50-200ms
- **Redis Connection**: 10-50ms
- **Query Performance**: 100-500ms
- **Cache Operations**: 20-100ms
- **Memory Usage**: 500MB-1GB RSS

### Necessita Otimização
- **Database Connection**: >200ms
- **Redis Connection**: >50ms
- **Query Performance**: >500ms
- **Cache Operations**: >100ms
- **Memory Usage**: >1GB RSS

---

## 🎉 Benefícios dos Scripts

### Para Desenvolvedores
- **Acesso Rápido**: Um comando na raiz executa tudo
- **Feedback Imediato**: Resultados em segundos
- **Debugging Facilitado**: Identifica problemas específicos
- **Validação Contínua**: Pode ser usado em CI/CD

### Para Operações
- **Monitoramento Simples**: Scripts padronizados
- **Diagnóstico Rápido**: Identifica gargalos
- **Validação de Deploy**: Confirma que sistema está saudável
- **Métricas Consistentes**: Sempre os mesmos testes

---

## 📋 Próximos Passos

### Automação
```bash
# Adicionar ao CI/CD
- name: Test Performance
  run: pnpm run test:performance
```

### Monitoramento
```bash
# Executar regularmente (cron job)
0 */6 * * * cd /path/to/project && pnpm run test:performance
```

### Alertas
```bash
# Integrar com sistemas de alerta
pnpm run test:performance | grep "❌" && send_alert
```

---

**Todos os scripts estão prontos e funcionando! Use `pnpm run test:performance` para começar. 🚀**

---

**Criado por:** Equipe ArtPlimERP  
**Data:** 09 de Janeiro de 2026  
**Versão:** 1.0.0  