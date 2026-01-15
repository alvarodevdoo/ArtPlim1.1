# ✅ Como Editar Perdas em Unidades

## 🎯 Funcionalidade Implementada

Agora você pode **editar as perdas em unidades** através da interface de configuração de produtos!

## 🔧 Como Acessar

### **1. Navegue até Produtos:**
- Acesse http://localhost:3000
- Vá em "Produtos" no menu

### **2. Configure um Produto:**
- Clique no ícone de **engrenagem (⚙️)** ao lado do produto
- Selecione a aba **"Materiais"**

### **3. Edite o Componente:**
- Clique no ícone de **lápis (✏️)** ao lado do material
- Verá o modal "Editar Componente"

## 🎨 Interface de Edição

### **Campos Disponíveis:**
```
┌─────────────────────────────────────────────┐
│ Editar Componente - Papel A4 75g            │
├─────────────────────────────────────────────┤
│ Método de Consumo: [Área (Chapa)     ▼]    │
│                                             │
│ Percentual de Perda Manual (%):            │
│ [____] (Deixe vazio para automático)       │
│ Atual calculado: 5.0%                      │
│                                             │
│ Perdas em Unidades (folha):                │
│ [____] Ex: 2 folha                         │
│ Atual configurado: 2 folha                 │
│ 💡 Perdas em unidades têm prioridade       │
│                                             │
│ Prioridade: [1]                            │
│ ☐ Material opcional                        │
│                                             │
│ Observações:                               │
│ [________________________]                 │
│                                             │
│           [Cancelar] [Salvar]              │
└─────────────────────────────────────────────┘
```

## 🔄 Como Funciona

### **Prioridade de Perdas:**
1. **Perdas em Unidades** (se preenchido)
2. **Percentual Manual** (se preenchido)
3. **Percentual Calculado** (automático)

### **Exemplos Práticos:**

#### **Cartão de Visita:**
- **Perdas em Unidades**: `3` folha
- **Resultado**: Sempre adiciona 3 folhas, independente da quantidade

#### **Banner:**
- **Perdas em Unidades**: `1.5` m²
- **Resultado**: Sempre adiciona 1.5 m², independente do tamanho

#### **Tinta:**
- **Perdas em Unidades**: `15` ml
- **Resultado**: Sempre adiciona 15ml, independente da quantidade

## 🧪 Teste Passo a Passo

### **1. Editar Perdas do Cartão:**
1. Vá em "Produtos"
2. Clique na engrenagem do "Cartão de Visita"
3. Clique no lápis do "Papel A4 75g"
4. Altere "Perdas em Unidades" para `5`
5. Clique "Salvar"

### **2. Testar o Cálculo:**
1. Vá em "Criar Pedido"
2. Selecione "Cartão de Visita"
3. Quantidade: 100
4. Veja: "Perda Aplicada: 5 folhas"

### **3. Comparar com Percentual:**
1. Volte na edição do componente
2. Limpe "Perdas em Unidades" (deixe vazio)
3. Coloque "Percentual de Perda Manual": `10`
4. Salve e teste novamente
5. Veja: "Perda Aplicada: 10.0%"

## 📊 Visualização na Lista

### **Na Lista de Componentes:**
```
📋 Papel A4 75g (SHEET)
   Método: Área (Chapa)
   Perda Atual: 5 folha    ← Mostra unidades
   Perda Calculada: 5.0%
   Custo: R$ 0,15/folha
```

### **No MaterialCalculator:**
```
📋 Papel A4 75g:
   - Necessário: 13 folhas
   - Perda Aplicada: 5 folhas    ← Mostra unidades
   - Custo: R$ 1,95
   - Status: ✅ Suficiente
```

## 🎯 Vantagens das Perdas em Unidades

### **1. Precisão:**
- Perdas fixas baseadas na experiência real
- Não varia com a quantidade do pedido

### **2. Simplicidade:**
- Fácil de entender: "sempre perco 2 folhas"
- Não precisa calcular percentuais

### **3. Realismo:**
- Baseado na realidade da produção
- Considera setup, testes, ajustes

### **4. Flexibilidade:**
- Pode usar unidades para alguns materiais
- Percentual para outros
- Combina conforme necessário

## 🔧 Configurações Recomendadas

### **Para Folhas (SHEET):**
- Use **unidades**: Ex: 2-5 folhas
- Considera: setup da máquina, testes de cor

### **Para Rolos (ROLL):**
- Use **unidades**: Ex: 0.5-1.0 m²
- Considera: início/fim do rolo, ajustes

### **Para Líquidos (UNIT):**
- Use **unidades**: Ex: 10-50 ml
- Considera: limpeza, testes, sobras

## 📁 Arquivos Modificados

- ✅ `frontend/src/components/catalog/ProductComponentManager.tsx`
- ✅ Interface de edição atualizada
- ✅ Exibição de perdas em unidades
- ✅ Prioridade correta entre tipos de perda

## 🎉 Resultado Final

### ✅ **Agora Você Pode:**
- Editar perdas em unidades facilmente
- Ver perdas em unidades na lista de componentes
- Testar diferentes configurações
- Usar unidades ou percentual conforme necessário

### 🌐 **Acesse e Teste:**
- http://localhost:3000
- Produtos → Engrenagem → Materiais → Lápis
- Configure suas perdas reais!

---

**Status: FUNCIONAL E EDITÁVEL** ✅

Agora você tem controle total sobre as perdas de materiais!