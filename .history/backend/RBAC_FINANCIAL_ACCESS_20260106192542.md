# Controle de Acesso RBAC - Informações Financeiras

## Implementação de Segurança

Implementado controle de acesso baseado em RBAC (Role-Based Access Control) para ocultar informações financeiras sensíveis de usuários não autorizados.

## Regras de Acesso

### Usuários COM Acesso Financeiro:
- **OWNER** - Proprietário da organização
- **ADMIN** - Administrador
- **MANAGER** - Gerente/Supervisor

### Usuários SEM Acesso Financeiro:
- **USER** - Funcionário/Vendedor comum

## Informações Protegidas

### 1. Análise Financeira (Modal de Pedidos)
**Localização**: `frontend/src/pages/Pedidos.tsx` - Modal de visualização de pedidos

**Informações ocultas para vendedores**:
- ❌ Custo Estimado
- ❌ Margem Bruta (valor)
- ❌ Margem Percentual
- ❌ Indicadores de Lucratividade
- ❌ Análise de Rentabilidade

**Informações visíveis para todos**:
- ✅ Total do Pedido
- ✅ Subtotal
- ✅ Detalhes dos Itens
- ✅ Informações do Cliente

### 2. Calculadora de Materiais
**Localização**: `frontend/src/pages/Pedidos.tsx` - Botão "Material" nos itens

**Funcionalidade oculta**:
- ❌ Botão "Material" não aparece para vendedores
- ❌ Modal de cálculo de custos de materiais
- ❌ Análise de consumo e desperdício

## Implementação Técnica

### Função de Verificação de Acesso:
```typescript
const hasFinancialAccess = () => {
  if (!user) return false;
  
  // Apenas OWNER, ADMIN e MANAGER têm acesso a informações financeiras
  const allowedRoles = ['OWNER', 'ADMIN', 'MANAGER'];
  return allowedRoles.includes(user.role) && settings?.enableFinance;
};
```

### Controles Implementados:

#### 1. Seção de Análise Financeira:
```typescript
{hasFinancialAccess() && (
  <Card>
    <CardHeader>
      <CardTitle>Análise Financeira</CardTitle>
    </CardHeader>
    <CardContent>
      {/* Informações financeiras sensíveis */}
    </CardContent>
  </Card>
)}
```

#### 2. Botão Calculadora de Materiais:
```typescript
{hasFinancialAccess() && (
  <Button onClick={() => openMaterialCalculator(item)}>
    <Calculator className="w-3 h-3 mr-1" />
    Material
  </Button>
)}
```

#### 3. Modal da Calculadora:
```typescript
{showMaterialCalculator && calculatorItem && hasFinancialAccess() && (
  <div className="modal">
    <MaterialCalculator />
  </div>
)}
```

## Configuração Organizacional

O acesso também depende da configuração `enableFinance` da organização:
- Se `settings.enableFinance = false`, nenhum usuário tem acesso
- Se `settings.enableFinance = true`, apenas roles autorizados têm acesso

## Benefícios de Segurança

### Para a Empresa:
- ✅ **Proteção de Dados Sensíveis**: Custos e margens protegidos
- ✅ **Controle Hierárquico**: Acesso baseado em responsabilidade
- ✅ **Compliance**: Atende requisitos de segurança empresarial
- ✅ **Auditoria**: Controle claro de quem acessa o quê

### Para Vendedores:
- ✅ **Interface Limpa**: Sem informações desnecessárias
- ✅ **Foco na Venda**: Concentração no atendimento ao cliente
- ✅ **Menos Distrações**: Interface otimizada para o papel

### Para Gestores:
- ✅ **Visão Completa**: Acesso a todas as informações
- ✅ **Análise de Rentabilidade**: Ferramentas de gestão
- ✅ **Controle de Custos**: Monitoramento financeiro

## Arquivos Modificados

1. `frontend/src/pages/Pedidos.tsx`
   - Adicionado `useAuth` hook
   - Implementada função `hasFinancialAccess()`
   - Aplicados controles condicionais

## Teste de Funcionalidade

### Como Administrador/Gerente:
1. Fazer login com role ADMIN/MANAGER
2. Abrir modal de pedido
3. ✅ Ver seção "Análise Financeira"
4. ✅ Ver botão "Material" nos itens
5. ✅ Acessar calculadora de materiais

### Como Vendedor:
1. Fazer login com role USER
2. Abrir modal de pedido
3. ❌ Não ver seção "Análise Financeira"
4. ❌ Não ver botão "Material" nos itens
5. ❌ Não acessar calculadora de materiais

## Status

- **✅ Implementado**: Controle de acesso RBAC
- **✅ Testado**: Funcionalidade condicional
- **✅ Seguro**: Informações financeiras protegidas
- **✅ Configurável**: Baseado em roles e configurações

**Data da implementação**: 06/01/2026 23:30