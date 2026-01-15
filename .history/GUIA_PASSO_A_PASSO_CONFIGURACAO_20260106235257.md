# 🎯 Guia Passo a Passo: Como Configurar Produtos e Materiais

## 📋 Pré-requisitos
- Frontend rodando em: http://localhost:3000
- Backend rodando em: http://localhost:3002
- Usuário logado no sistema

## 🚀 Passo 1: Acessar a Aplicação

1. **Abra seu navegador** e acesse: `http://localhost:3000`
2. **Faça login** no sistema com suas credenciais
3. **Verifique se está logado** - você deve ver o menu principal

## 📦 Passo 2: Configurar Materiais (Primeiro)

### 2.1 Acessar Catálogo de Materiais
1. No menu principal, clique em **"Catálogo"** ou **"Materiais"**
2. Você verá a lista de materiais existentes

### 2.2 Criar Novos Materiais (se necessário)
1. Clique em **"Adicionar Material"**
2. Preencha os campos:
   - **Nome**: Ex: "Papel Sulfite A4 75g"
   - **Formato**: SHEET (folha), ROLL (rolo), ou UNIT (unidade)
   - **Largura Padrão**: Ex: 210mm (para A4)
   - **Comprimento Padrão**: Ex: 297mm (para A4)
   - **Custo por Unidade**: Ex: R$ 0,15
   - **Unidade**: Ex: "folha"
   - **Estoque Atual**: Ex: 1000
3. Clique em **"Salvar"**

## 🏷️ Passo 3: Configurar Produtos

### 3.1 Acessar Produtos
1. No menu, clique em **"Produtos"**
2. Você verá a lista de produtos existentes

### 3.2 Selecionar um Produto para Configurar
1. **Clique em um produto** da lista
2. Você verá **3 abas**:
   - **Informações Básicas**
   - **Componentes** ← **ESTA É A ABA IMPORTANTE!**
   - **Configurações**

## 🔧 Passo 4: Vincular Materiais ao Produto

### 4.1 Acessar a Aba "Componentes"
1. **Clique na aba "Componentes"**
2. Você verá a interface para gerenciar materiais do produto

### 4.2 Adicionar Material ao Produto
1. Clique em **"Adicionar Material"**
2. **Selecione o material** no dropdown
3. **Configure o método de consumo**:
   - **BOUNDING_BOX**: Para materiais em folha (calcula por área)
   - **LINEAR_NEST**: Para materiais em rolo (calcula por comprimento)
   - **FIXED_AMOUNT**: Quantidade fixa por item
4. **Defina a prioridade**: 1 = mais importante
5. **Marque se é opcional** (se aplicável)
6. **Adicione observações** (se necessário)
7. Clique em **"Salvar"**

### 4.3 Exemplo Prático - Cartão de Visita
```
Material: Papel Couché 300g
Método: BOUNDING_BOX (área)
Prioridade: 1
Opcional: Não
Observações: Material principal para impressão
```

## 📊 Passo 5: Testar o Cálculo de Materiais

### 5.1 Criar um Novo Pedido
1. Vá para **"Pedidos"** → **"Criar Pedido"**
2. **Selecione um cliente**
3. Clique em **"Adicionar Item"**

### 5.2 Ver o Cálculo em Tempo Real
1. **Selecione o produto** que você configurou
2. **Digite as dimensões**: Ex: 90mm x 50mm
3. **Digite a quantidade**: Ex: 1000 unidades
4. **Automaticamente aparecerá** a seção **"Materiais Necessários"**
5. Você verá:
   - Materiais necessários
   - Quantidade calculada
   - Custo dos materiais
   - Estoque disponível
   - Avisos (se houver problemas)

## 🎯 Exemplo Completo: Configurando Cartões de Visita

### Material Necessário:
- **Nome**: Papel Couché 300g
- **Formato**: SHEET
- **Dimensões**: 660mm x 960mm (folha SRA1)
- **Custo**: R$ 8,50 por folha
- **Estoque**: 100 folhas

### Configuração do Produto:
- **Produto**: Cartão de Visita
- **Material**: Papel Couché 300g
- **Método**: BOUNDING_BOX
- **Prioridade**: 1

### Teste do Cálculo:
- **Dimensões**: 90mm x 50mm
- **Quantidade**: 1000 unidades
- **Resultado**: Sistema calculará quantas folhas são necessárias

## ❗ Problemas Comuns e Soluções

### "Nenhum material configurado"
- **Causa**: Produto não tem materiais vinculados
- **Solução**: Siga o Passo 4 para vincular materiais

### "Erro ao carregar materiais"
- **Causa**: Problema de conexão ou autenticação
- **Solução**: Verifique se está logado e se o backend está rodando

### "Estoque insuficiente"
- **Causa**: Não há material suficiente em estoque
- **Solução**: Atualize o estoque do material ou ajuste a quantidade

### MaterialCalculator não aparece
- **Causa**: Produto, dimensões ou quantidade não preenchidos
- **Solução**: Preencha todos os campos obrigatórios

## 🔍 Onde Encontrar Cada Funcionalidade

### No Menu Principal:
- **Catálogo** → Gerenciar materiais
- **Produtos** → Configurar produtos e vincular materiais
- **Pedidos** → Testar cálculos em tempo real

### Na Página de Produtos:
- **Aba "Componentes"** → Vincular materiais
- **Aba "Configurações"** → Configurações dinâmicas

### Na Criação de Pedidos:
- **Formulário de Item** → Ver cálculo automático de materiais

## 📞 Próximos Passos

1. **Teste com um produto simples** primeiro
2. **Configure materiais básicos** (papel, tinta, etc.)
3. **Vincule um material por vez** para entender o processo
4. **Teste o cálculo** criando um pedido
5. **Ajuste as configurações** conforme necessário

---

**💡 Dica**: Comece sempre configurando os materiais primeiro, depois vincule aos produtos, e por último teste criando um pedido!