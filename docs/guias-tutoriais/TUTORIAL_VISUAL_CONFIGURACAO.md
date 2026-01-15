# 🎯 Tutorial Visual: Como Configurar Produto-Material

## ✅ A Interface Está Pronta! Siga Estes Passos:

### 📍 Passo 1: Acessar a Página de Produtos

1. **Abra o navegador**: `http://localhost:3000`
2. **Faça login** no sistema
3. **Procure no menu** por "Produtos" e clique

### 📍 Passo 2: Encontrar o Botão de Configuração

Na lista de produtos, você verá **cards** (cartões) para cada produto.

**Em cada card do produto, procure por:**
```
┌─────────────────────────────────────┐
│ Nome do Produto              [⚙️][✏️][🗑️] │ ← Procure pelo ícone ⚙️ (engrenagem)
│ Descrição do produto                │
│ Preço: R$ XX,XX                    │
└─────────────────────────────────────┘
```

**CLIQUE NO ÍCONE ⚙️ (Settings/Engrenagem)**

### 📍 Passo 3: Modal de Configuração Abrirá

Quando clicar no ícone ⚙️, abrirá um **modal grande** com:

```
┌─────────────────────────────────────────────────────────┐
│ 🔧 Configurar Produto                          [Fechar] │
├─────────────────────────────────────────────────────────┤
│ Nome do Produto - Tipo de Preço                        │
├─────────────────────────────────────────────────────────┤
│ [📦 Materiais] [⚙️ Configurações]                       │ ← DUAS ABAS
├─────────────────────────────────────────────────────────┤
│                                                         │
│ CONTEÚDO DA ABA SELECIONADA                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 📍 Passo 4: Configurar Materiais

1. **Certifique-se** que a aba **"📦 Materiais"** está selecionada (deve estar azul)
2. **Você verá** a interface do `ProductComponentManager`
3. **Procure pelo botão** "Adicionar Material" ou "+"

### 📍 Passo 5: Adicionar Material ao Produto

Quando clicar em "Adicionar Material":

```
┌─────────────────────────────────────┐
│ Adicionar Material                  │
├─────────────────────────────────────┤
│ Material: [Selecione... ▼]          │ ← Dropdown com materiais
│ Método: [BOUNDING_BOX ▼]            │ ← Como calcular consumo
│ Prioridade: [1]                     │ ← Ordem de importância
│ □ Material Opcional                 │ ← Marque se for opcional
│ Observações: [____________]         │ ← Notas opcionais
│                                     │
│ [Cancelar] [Salvar]                 │
└─────────────────────────────────────┘
```

### 📍 Passo 6: Configurar os Campos

**Material**: Selecione da lista (ex: "Papel Sulfite A4")
**Método de Consumo**:
- **BOUNDING_BOX**: Para folhas (calcula por área)
- **LINEAR_NEST**: Para rolos (calcula por comprimento)  
- **FIXED_AMOUNT**: Quantidade fixa por item

**Prioridade**: 1 = mais importante, 2 = menos importante
**Opcional**: Marque se o material não é obrigatório

### 📍 Passo 7: Testar a Configuração

1. **Salve** a configuração
2. **Feche** o modal
3. **Vá para** "Criar Pedido"
4. **Selecione** o produto que você configurou
5. **Digite** dimensões e quantidade
6. **Veja** a seção "Materiais Necessários" aparecer automaticamente!

## 🚨 Se Não Funcionar

### Problema: Não vejo o ícone ⚙️
**Solução**: Verifique se você tem permissão de administrador

### Problema: Modal não abre
**Solução**: Verifique o console do navegador (F12) para erros

### Problema: Lista de materiais vazia
**Solução**: Primeiro cadastre materiais em "Catálogo" → "Materiais"

### Problema: Erro ao salvar
**Solução**: Verifique se o backend está rodando (http://localhost:3002)

## 📱 Exemplo Prático Completo

### 1. Cadastrar Material (se não existir):
- **Nome**: Papel Sulfite A4 75g
- **Formato**: SHEET
- **Largura**: 210mm
- **Altura**: 297mm
- **Custo**: R$ 0,15
- **Estoque**: 1000

### 2. Configurar Produto:
- **Produto**: Flyer A4
- **Material**: Papel Sulfite A4 75g
- **Método**: BOUNDING_BOX
- **Prioridade**: 1

### 3. Testar:
- **Criar pedido** → **Flyer A4** → **210x297mm** → **100 unidades**
- **Resultado**: Sistema mostra "100 folhas necessárias"

---

**🎉 Pronto! Agora você sabe exatamente onde clicar para configurar os vínculos produto-material!**