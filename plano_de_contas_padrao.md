# Plano de Contas Padrão (Curadoria ArtPlim)

Este documento detalha a estrutura **simplificada e otimizada** do plano de contas padrão, focada nas operações reais de uma Gráfica e Comunicação Visual (MDF, Laser, Carimbos, etc).

---

## 1. ATIVO (O que a empresa "Tem")
*Representa os bens e direitos. Se o Ativo for maior que o Passivo, o Patrimônio Líquido é positivo.*

| Código | Tipo | Nome | Orientação de Uso |
|:---|:---:|:---|:---|
| **1** | [S] | Ativo | Grupo Mestre: Tudo o que a empresa possui. |
| **1.1** | [S] | Ativo Circulante | Itens de "giro rápido" que viram dinheiro em < 1 ano. |
| **1.1.1** | [S] | Disponibilidades | Dinheiro pronto para uso imediato. |
| 1.1.1.01 | [A] | Caixa Geral | Dinheiro em espécie na gaveta (troco/miudezas). |
| 1.1.1.02 | [A] | Bancos Conta Movimento | Saldo em contas correntes bancárias. |
| **1.1.3** | [S] | Estoques | Valor financeiro dos materiais em prateleira. |
| 1.1.3.01 | [A] | Estoque: Papéis e Mídias | Papéis, Lonas, Vinil, Filmes de laminação. |
| 1.1.3.02 | [A] | Estoque: Rígidos (Laser) | MDF, Acrílico, PS e metais de corte. |
| 1.1.3.03 | [A] | Estoque: Brindes e Bases | Copos, garrafas e carimbos base. |
| **1.2** | [S] | Ativo Não Circulante | Bens de estrutura que não serão vendidos rápido. |
| **1.2.1** | [S] | Imobilizado | Patrimônio físico durável da gráfica. |
| 1.2.1.01 | [A] | Máquinas e Equipamentos | Impressoras, Routers, Lasers e Prensas. |

---

## 2. PASSIVO (O que a empresa "Deve")
*Indica obrigações com fornecedores, governo e funcionários.*

| Código | Tipo | Nome | Orientação de Uso |
|:---|:---:|:---|:---|
| **2** | [S] | Passivo | Grupo Mestre: Todas as dívidas e obrigações. |
| **2.1** | [S] | Passivo Circulante | Dívidas que vencem nos próximos 12 meses. |
| **2.1.1** | [S] | Obrigações com Fornecedores | Contas a pagar de insumos e serviços. |
| 2.1.1.01 | [A] | Fornecedores de Insumos | Boletos de MDF, Papéis, Tintas e Lonas. |
| **2.1.3** | [S] | Obrigações Tributárias | Impostos a recolher (DAS, ICMS, ISS). |
| 2.1.3.01 | [A] | Simples Nacional (DAS) | Guia unificada mensal da sua empresa. |
| **2.3** | [S] | Patrimônio Líquido | Valor real que sobra para os sócios. |
| 2.3.1.01 | [A] | Capital Social | Investimento inicial feito para abrir a loja. |

---

## 3. RECEITAS (Faturamento da Gráfica)
*Entrada bruta de dinheiro. Mede o que é o "carro-chefe" da operação.*

| Código | Tipo | Nome | Orientação de Uso |
|:---|:---:|:---|:---|
| **3** | [S] | Receitas | Todo o dinheiro que entra pelas vendas. |
| **3.1** | [S] | Receita Bruta Operacional | Faturamento total antes de deduções. |
| **3.1.1** | [S] | Produção Própria | Itens feitos nas suas máquinas. |
| 3.1.1.01 | [A] | Gráfica e Encadernação | Impressos, plastificações, banners. |
| 3.1.1.03 | [A] | Corte e Gravação Laser | Itens em MDF, Acrílico e Garrafas gravadas. |
| 3.1.1.04 | [A] | Carimbos Personalizados | Aparelho + Borracha gravada. |
| **3.1.2** | [S] | Revenda e Terceirização | Itens que você vende mas roda fora. |
| 3.1.2.01 | [A] | Revenda Sob Demanda | Ex: Milheiro de cartão enviado para gráfica parceira. |

---

## 4. CUSTOS (Gastos Variáveis)
*Se você não produzir nada hoje, esse custo deve ser zero.*

| Código | Tipo | Nome | Orientação de Uso |
|:---|:---:|:---|:---|
| **4** | [S] | Custos | Gastos que variam com o volume de produção. |
| **4.1** | [S] | Custos Operacionais | Soma do gasto para fabricar os produtos. |
| **4.1.1** | [S] | Custo dos Produtos (CPV) | Insumos que saíram do estoque para o pedido. |
| 4.1.1.01 | [A] | Matéria-Prima Consumida | Custo do MDF, Lona ou Papel usado. |
| 4.1.1.02 | [A] | Tintas, Gases e Insumos | Recargas de tinta e gás do tubo Laser. |
| 4.1.1.05 | [A] | Perdas e Desperdícios | Material perdido por erro de produção. |

---

## 5. DESPESAS (Gastos Fixos)
*Custos para manter o ArtPlim aberto, independente de ter cliente.*

| Código | Tipo | Nome | Orientação de Uso |
|:---|:---:|:---|:---|
| **5** | [S] | Despesas | Gastos fixos de estrutura. |
| **5.1** | [S] | Despesas Operacionais | Suporte administrativo e financeiro. |
| 5.1.1.02 | [A] | Aluguel e IPTU | Custo mensal do espaço físico. |
| 5.1.3.02 | [A] | Taxas de Maquininha e Boletos | Custo financeiro por transação de venda. |

---

## 9. CONTAS DE CONTROLE (Materiais de Terceiros)
*Fundamental para serviços em itens trazidos pelo cliente.*

| Código | Tipo | Nome | Orientação de Uso |
|:---|:---:|:---|:---|
| **9** | [S] | Contas de Controle | Registro de itens que não são da empresa. |
| 9.1.1.01 | [A] | Materiais de Clientes | Garrafas, MDF ou Brindes trazidos p/ gravação. |

---

## Legenda:
- **[S] Sintética**: Conta de grupo (soma os filhos).
- **[A] Analítica**: Conta de movimento (usada nos lançamentos).
