# 🎯 Onde Encontrar as Configurações de Produto-Material

## 🔍 Localizando as Telas no Sistema

### 1. 📦 Configurar Materiais

**Caminho no Menu:**
```
Menu Principal → Catálogo → Materiais
```

**O que você verá:**
- Lista de materiais existentes
- Botão "Adicionar Material" ou "Novo Material"
- Campos: Nome, Formato, Dimensões, Custo, Estoque

### 2. 🏷️ Configurar Produtos

**Caminho no Menu:**
```
Menu Principal → Produtos
```

**O que você verá:**
- Lista de produtos
- Clique em um produto para abrir detalhes
- **IMPORTANTE**: Procure por abas ou seções como:
  - "Componentes"
  - "Materiais"
  - "Configuração de Materiais"

### 3. 🔗 Vincular Material ao Produto

**Dentro da página do produto:**
1. **Procure pela aba "Componentes"** (pode estar no topo da página)
2. **Ou procure por uma seção "Materiais do Produto"**
3. **Botão "Adicionar Material"** ou "Vincular Material"

## 📱 Interface Visual - O que Procurar

### Na Página de Produtos:
```
┌─────────────────────────────────────┐
│ Produto: Cartão de Visita           │
├─────────────────────────────────────┤
│ [Básico] [Componentes] [Config]     │ ← CLIQUE EM "COMPONENTES"
├─────────────────────────────────────┤
│ Materiais Configurados:             │
│ ┌─────────────────────────────────┐ │
│ │ + Adicionar Material            │ │ ← CLIQUE AQUI
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### No Modal de Adicionar Material:
```
┌─────────────────────────────────────┐
│ Adicionar Material ao Produto       │
├─────────────────────────────────────┤
│ Material: [Dropdown ▼]              │
│ Método: [BOUNDING_BOX ▼]            │
│ Prioridade: [1]                     │
│ □ Opcional                          │
│ Observações: [_____________]        │
│                                     │
│ [Cancelar] [Salvar]                 │
└─────────────────────────────────────┘
```

## 🚨 Se Não Encontrar as Telas

### Opção 1: Verificar URLs Diretas
Tente acessar diretamente:
- **Materiais**: `http://localhost:3000/materiais` ou `http://localhost:3000/catalog/materials`
- **Produtos**: `http://localhost:3000/produtos` ou `http://localhost:3000/catalog/products`

### Opção 2: Procurar no Menu
Procure por estas palavras no menu:
- "Catálogo"
- "Produtos" 
- "Materiais"
- "Estoque"
- "Configurações"

### Opção 3: Verificar Permissões
Se não vê as opções, pode ser problema de permissão:
- Verifique se seu usuário tem acesso ao módulo de catálogo
- Tente fazer login com usuário administrador

## 🧪 Testar se Está Funcionando

### Teste Rápido:
1. **Vá para "Criar Pedido"**
2. **Selecione um produto**
3. **Digite dimensões e quantidade**
4. **Procure por uma seção "Materiais Necessários"** ou "Calculadora de Materiais"

Se aparecer esta seção, o sistema está funcionando!

## 📞 Próximos Passos Baseados no Problema

### Se você NÃO encontra o menu:
- Verifique se está logado como administrador
- Procure por "Configurações" ou "Admin"

### Se você encontra mas dá erro:
- Verifique se o backend está rodando (http://localhost:3002)
- Olhe o console do navegador (F12) para ver erros

### Se você encontra mas não entende:
- Siga o guia passo a passo que criei
- Comece configurando um material simples primeiro

---

**💡 Dica Importante**: Se você não vê as opções de "Componentes" ou "Materiais" na página do produto, pode ser que a interface ainda não esteja totalmente integrada. Neste caso, me avise e posso ajudar a verificar a implementação!