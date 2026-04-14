# Guia de Configuração Financeira e Operacional - NArtPlim

Este guia explica como configurar corretamente o relacionamento entre Materiais (Insumos), Categorias e o Plano de Contas para garantir que o seu ERP gere relatórios de lucratividade (DRE) e controle de estoque precisos.

---

## 1. O Triângulo de Ouro: Como os dados se conectam

No NArtPlim, cada item que gera custo ou receita segue este fluxo:
**Insumo (Material)** -> **Categoria** -> **Plano de Contas**.

1.  **Insumo:** É o item físico ou serviço (ex: Vinil, Cartão de Visita, Tinta).
2.  **Categoria:** É o grupo que define o comportamento contábil (ex: Mídias Flexíveis, Serviços Terceirizados).
3.  **Plano de Contas:** É o destino final no financeiro (ex: Ativo de Estoque ou Custo de Mercadoria Vendida).

---

## 2. Cenários de Configuração

Existem dois perfis principais de itens no sistema:

### A. Itens Estocáveis (Commodities)
São materiais que você compra em grande quantidade e ficam na prateleira (ex: Rolo de Lona, Cola, MDF).
*   **Monitoramento Ativo:** `LIGADO`.
*   **Conta de Ativo (Estoque):** `1.1.3.01 - Estoque: Papéis e Mídias` (ou similar).
*   **Conta de Custo (DRE):** `4.1.1.01 - Chapas e Mídias Consumidas`.
*   **Comportamento:** O custo só é lançado no financeiro quando o material é **consumido** na produção.

### B. Itens Sob Demanda / Terceirizados
São materiais personalizados para um cliente específico ou comprados "venda a venda" (ex: Vinil Impresso de Terceiro, Brinde Personalizado, Fotoprodutos).
*   **Monitoramento Ativo:** `DESLIGADO`.
*   **Conta de Ativo (Estoque):** Pode ser a mesma do item estocável (é apenas uma referência).
*   **Conta de Custo (DRE):** `4.1.3.01 - Custos com Gráficas Parceiras`.
*   **Comportamento:** Como o estoque está desligado, o sistema ignora a quantidade física, mas usa o preço de custo para calcular o lucro do orçamento instantaneamente.

---

## 3. Passo a Passo: Configurando um Novo Insumo Terceirizado

Para configurar itens como o seu **Vinil Terceirizado**, siga este checklist:

1.  **Aba Cadastro:**
    *   **Nome:** Identifique se é terceirizado (ex: Vinil Brilho - Produção Externa).
    *   **Unidade de Medida:** Use a unidade que o fornecedor te cobra (ex: `m²`).
    *   **Preço de Compra:** O valor que você paga por unidade (ex: `25.00`).
    *   **Monitoramento Ativo:** `DESMARCADO` (Essencial para itens sob demanda).

2.  **Inteligência de Cálculo:**
    *   **Largura/Altura:** Deixe como `0` se o custo for por m² direto. 
    *   **Regra de Consumo:** Selecione `Área do Item` (para que o sistema use as medidas que o vendedor digitar no orçamento).

3.  **Categoria:**
    *   Selecione uma categoria que aponte para a conta **4.1.3.01 (Custos com Gráficas Parceiras)**.
    *   Isso garante que, ao pagar o fornecedor, o gasto apareça corretamente na DRE como um custo de produção por terceiros.

---

## 4. DRE (Demonstrativo de Resultados)
Para que sua DRE seja real, o sistema faz o seguinte cálculo automático:
> **Receita (Venda)** - **Custos (Insumos da Ficha Técnica)** = **Margem de Contribuição**.

Se você configurar a categoria corretamente, você saberá exatamente quanto do seu faturamento está ficando retido nos seus fornecedores parceiros.

---

## 5. Dicas de Ouro
*   **Categorias Genéricas:** Se estiver na dúvida, crie uma categoria apenas para "Terceirizados" e outra para "Materiais Próprios". Isso já resolve 90% da sua organização.
*   **Markup:** Lembre-se que o Preço de Custo aqui é o que VOCÊ paga. O sistema usará as fórmulas de precificação para sugerir o preço de venda para o seu cliente final.
