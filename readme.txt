Esta é a **Documentação Técnica Definitiva (Version 1.0)** para o **ArtPlimERP**.

Como Engenheiro de Software Sênior, compilei a arquitetura de **Banco de Dados**, **Estrutura de Pastas** e a **Implementação do Backend (Lógica de Negócio)**. Esta estrutura é otimizada para performance (Fastify), segurança de dados (Prisma/Postgres) e escalabilidade modular.

---

# 📘 Parte 1: Estrutura de Arquivos (Backend)

O padrão adotado é o **Monólito Modular**. Organizado por domínios funcionais, não por camadas técnicas.

```text
/backend
├── src/
│   ├── @core/                 # O KERNEL (Infraestrutura Compartilhada)
│   │   ├── config/            # Env vars (Porta, DB Host)
│   │   ├── database/          # Prisma Client Instance
│   │   ├── errors/            # AppError e Global Error Handler
│   │   ├── lib/               # Filas (BullMQ), Cache (Redis), Logger
│   │   └── pricing-engine/    # O CÉREBRO de cálculo (Isolado dos módulos)
│   │       ├── PricingEngine.ts
│   │       └── calculators/   # Algoritmos (Laser, Print, Finishing)
│   │
│   ├── modules/               # OS MÓDULOS DE NEGÓCIO
│   │   ├── catalog/           # (Base) Produtos, Materiais, Receitas
│   │   ├── inventory/         # (WMS) Rolos, Chapas, Movimentações
│   │   ├── sales/             # (CRM) Orçamentos, Pedidos, Integração n8n
│   │   ├── production/        # (PCP) Chão de Fábrica, Fila de Impressão
│   │   ├── finance/           # (ERP) Contas Pagar/Receber
│   │   ├── logistics/         # (TMS) Entregas e Rotas
│   │   └── workforce/         # (RH) Funcionários e Ponto
│   │
│   ├── shared/                # Utilitários Globais
│   │   ├── providers/         # Storage (S3), Mailer
│   │   └── utils/             # Formatadores, Validadores Zod Genéricos
│   │
│   ├── app.ts                 # Configuração do Fastify
│   └── server.ts              # Entry Point
│
├── prisma/
│   └── schema.prisma          # Modelagem do Banco
└── package.json

```

---

# 📙 Parte 2: O Banco de Dados (Prisma Schema)

Este schema suporta **Venda Simples (m²)** e **Venda Complexa (Engenharia)**, além de estoque de **Rolos e Chapas**.

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ==========================================
// 1. CONFIGURAÇÕES E MODULARIDADE
// ==========================================

model OrganizationSettings {
  id                String  @id @default(uuid())
  
  // Feature Flags (Ligam/Desligam módulos no Front/Back)
  enableEngineering Boolean @default(false) // Ativa cálculos complexos
  enableWMS         Boolean @default(false) // Ativa controle de rolos/chapas
  enableProduction  Boolean @default(false) // Ativa fila de fábrica
}

// ==========================================
// 2. CATÁLOGO (Produtos e Receitas)
// ==========================================

enum PricingMode {
  SIMPLE_AREA       // R$ 30,00/m²
  SIMPLE_UNIT       // R$ 10,00 un
  DYNAMIC_ENGINEER  // Custo Material + Tempo Máquina + Markup
}

model Product {
  id            String      @id @default(uuid())
  name          String
  pricingMode   PricingMode @default(SIMPLE_AREA)
  
  // MODO SIMPLES
  salePrice     Decimal?    // Preço Tabela
  minPrice      Decimal?    // Preço Mínimo
  
  // MODO ENGENHARIA (A Receita)
  markup        Float       @default(1.0) // 1.0 = Custo Zero, 2.0 = 100% Lucro
  components    ProductComponent[] // Materiais consumidos
  operations    ProductOperation[] // Tempo de máquina
  
  // ACABAMENTOS (Ilhós, Laminação)
  allowedAddons ProductAddon[] 
}

model ProductComponent {
  id          String   @id @default(uuid())
  productId   String
  product     Product  @relation(fields: [productId], references: [id])
  materialId  String
  material    Material @relation(fields: [materialId], references: [id])
  
  // Como calcular o consumo?
  // "BOUNDING_BOX" (Retângulo para chapas), "LINEAR_NEST" (Para rolos)
  consumptionMethod String 
}

// ==========================================
// 3. ESTOQUE (WMS - O Coração da Gráfica)
// ==========================================

enum MaterialFormat {
  ROLL    // Controlado por Comprimento (Lona, Vinil)
  SHEET   // Controlado por Área/Retalho (ACM, Acrílico)
  UNIT    // Controlado por Qtd (Tinta, Fita)
}

model Material {
  id          String         @id @default(uuid())
  name        String         // "Lona 440g Fosca"
  format      MaterialFormat 
  costPerUnit Decimal        // Custo de compra (m², ml ou un)
  
  inventoryItems InventoryItem[]
  components     ProductComponent[]
}

model InventoryItem {
  id          String   @id @default(uuid())
  materialId  String
  material    Material @relation(fields: [materialId], references: [id])
  
  // Dimensões Físicas Reais
  width       Float    // mm (Fixo no rolo/chapa)
  length      Float?   // mm (Variável no Rolo: quanto sobra de comprimento)
  height      Float?   // mm (Variável na Chapa: altura do pedaço)
  
  quantity    Int      // Unidades (Ex: 5 chapas idênticas)
  
  isOffcut    Boolean  @default(false) // É retalho/sobra?
  location    String?  // Endereçamento
}

// ==========================================
// 4. VENDAS (CRM)
// ==========================================

model Order {
  id          String      @id @default(uuid())
  customerId  String
  status      String      // DRAFT, APPROVED, IN_PRODUCTION, DONE
  items       OrderItem[]
  totalFinal  Decimal
}

model OrderItem {
  id              String   @id @default(uuid())
  orderId         String
  order           Order    @relation(fields: [orderId], references: [id])
  productId       String
  
  // Inputs
  width           Float
  height          Float
  quantity        Int
  
  // A Tríade do Preço (Vital para Relatórios)
  costPrice       Decimal  // Custo Interno
  calculatedPrice Decimal  // Preço Sugerido (Tabela)
  unitPrice       Decimal  // Preço Praticado (Editado pelo vendedor)
  
  addons          OrderItemAddon[]
}

model OrderItemAddon {
  id          String  @id @default(uuid())
  orderItemId String
  orderItem   OrderItem @relation(fields: [orderItemId], references: [id])
  name        String  // Ex: "Ilhós"
  price       Decimal // Valor cobrado
}

```

---

# 📗 Parte 3: O Backend (Lógica e Código)

Aqui está como implementar os Services principais usando **TypeScript**.

### 1. O Motor de Precificação (`@core/pricing-engine`)

Este serviço decide se calcula simples ou complexo.

```typescript
// src/@core/pricing-engine/PricingEngine.ts

import { Decimal } from '@prisma/client/runtime/library';

interface CalculationInput {
  product: any; // O objeto Product do Prisma completo (com components)
  width: number;  // mm
  height: number; // mm
  quantity: number;
}

interface CalculationOutput {
  costPrice: number;       // Quanto custa pra você
  calculatedPrice: number; // Preço de tabela sugerido
  details: string[];       // Log do cálculo ("Cobrado 2m² de lona")
}

export class PricingEngine {
  
  execute(input: CalculationInput): CalculationOutput {
    const { product, width, height, quantity } = input;
    
    // MODO 1: Preço Simples (m²)
    if (product.pricingMode === 'SIMPLE_AREA') {
      const areaM2 = (width * height) / 1_000_000;
      const basePrice = Number(product.salePrice) || 0;
      const total = areaM2 * basePrice * quantity;
      
      return {
        costPrice: 0, // No modo simples, custo é ignorado ou estimado
        calculatedPrice: Math.max(total, Number(product.minPrice || 0)),
        details: [`Cálculo Simples: ${areaM2.toFixed(2)}m² x R$ ${basePrice}`]
      };
    }

    // MODO 2: Engenharia (Custo + Margem)
    if (product.pricingMode === 'DYNAMIC_ENGINEER') {
      let totalCost = 0;
      const logs: string[] = [];

      // A. Custo de Materiais
      for (const component of product.components) {
        // Lógica de consumo (ex: Bounding Box para chapa)
        // Aqui você implementaria a lógica de perda técnica
        const materialCost = this.calculateMaterialCost(component, width, height);
        totalCost += materialCost;
        logs.push(`Material ${component.material.name}: R$ ${materialCost.toFixed(2)}`);
      }

      // B. Custo de Operações (Máquina)
      for (const op of product.operations) {
        // Ex: Laser (Perímetro / Velocidade)
        const opCost = this.calculateOperationCost(op, width, height);
        totalCost += opCost;
      }

      const suggestedPrice = totalCost * product.markup; // Aplica margem

      return {
        costPrice: totalCost * quantity,
        calculatedPrice: suggestedPrice * quantity,
        details: logs
      };
    }

    throw new Error("Modo de precificação inválido");
  }

  private calculateMaterialCost(component: any, w: number, h: number): number {
    // Exemplo simplificado
    const area = (w * h) / 1_000_000;
    return area * Number(component.material.costPerUnit);
  }
  
  private calculateOperationCost(op: any, w: number, h: number): number {
      // Implementar lógica de tempo de máquina
      return 0; 
  }
}

```

### 2. O Módulo de Vendas (`modules/sales`)

O Controller que recebe o pedido do Frontend ou do n8n.

```typescript
// src/modules/sales/services/SimulateQuoteService.ts

import { prisma } from '../../../@core/database/prisma';
import { PricingEngine } from '../../../@core/pricing-engine/PricingEngine';

export class SimulateQuoteService {
  constructor(private pricingEngine: PricingEngine) {}

  async execute({ productId, width, height, quantity }: any) {
    // 1. Busca produto com a "Receita" completa
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { 
        components: { include: { material: true } }, 
        operations: true 
      }
    });

    if (!product) throw new Error("Produto não encontrado");

    // 2. Roda o motor de cálculo
    const result = this.pricingEngine.execute({
      product,
      width,
      height,
      quantity
    });

    // 3. Retorna estrutura limpa para o Front/Chat
    return {
      productId: product.id,
      productName: product.name,
      pricing: {
        cost: result.costPrice,       // Só mostrar para ADMIN
        suggested: result.calculatedPrice,
        min: Number(product.minPrice)
      },
      breakdown: result.details
    };
  }
}

```

### 3. O Módulo de Estoque (`modules/inventory`)

A lógica de **Baixa Inteligente** (Onde você ganha dinheiro economizando).

```typescript
// src/modules/inventory/services/ConsumeMaterialService.ts

export class ConsumeMaterialService {
  async execute(materialId: string, requiredLengthMm: number) {
    // LÓGICA PARA ROLOS (FIFO - First In, First Out)
    
    // 1. Busca rolos disponíveis desse material
    const rolls = await prisma.inventoryItem.findMany({
      where: { 
        materialId, 
        material: { format: 'ROLL' },
        length: { gte: requiredLengthMm } // Só pega rolo que aguenta o pedido
      },
      orderBy: { length: 'asc' } // Tenta pegar o menor rolo possível (Best Fit) para acabar com retalhos
    });

    if (rolls.length === 0) throw new Error("Estoque insuficiente para este tamanho");

    const selectedRoll = rolls[0];

    // 2. Debita o comprimento
    const newLength = (selectedRoll.length || 0) - requiredLengthMm;

    // 3. Atualiza o banco
    await prisma.inventoryItem.update({
      where: { id: selectedRoll.id },
      data: { length: newLength }
    });
    
    // Se o rolo ficar com menos de 1 metro, marcar como "Final de Rolo" ou Lixo?
    // Lógica adicional viria aqui.

    return { usedRollId: selectedRoll.id, remaining: newLength };
  }
}

```

---

# 📘 Parte 4: Integração de Sistemas

### Como o n8n se conecta aqui?

Você criará uma rota específica em `src/modules/sales/sales.routes.ts`:

* **Rota:** `POST /integrations/chat/quote`
* **Body:** `{ "text": "Quero adesivo 50x50", "phone": "55..." }`
* **Lógica:** O Controller chama o `SimulateQuoteService` (o mesmo do painel) e formata a resposta como texto.

### Como o Frontend (React) consome?

O Frontend nunca chama o banco. Ele chama a API:

```javascript
// Exemplo de chamada no React
const handleSimulate = async () => {
  const response = await api.post('/sales/simulate', {
    productId: selectedProduct.id,
    width: 1000,
    height: 500,
    quantity: 1
  });
  
  // O backend devolve "suggested: 45.00".
  // Você preenche o campo "Preço Final" com 45.00, mas deixa o usuário editar.
  setPrice(response.data.pricing.suggested);
};

No shadcn/ui, o gerenciamento de temas (Claro/Escuro) e cores é feito através de Variáveis CSS Nativa em um arquivo global.

Aqui está como estruturar isso para que seu código fique limpo e modular:

1. Centralização das Cores (src/app/globals.css)
Em vez de classes Tailwind espalhadas, o shadcn centraliza os "tokens" de cor aqui. Quando você muda o tema, o sistema apenas troca os valores das variáveis, e todos os componentes se ajustam automaticamente.

CSS

/* src/app/globals.css */
@layer base {
  :root {
    /* MODO CLARO */
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%; /* Seu Azul ArtPlim */
    --primary-foreground: 210 40% 98%;
    --radius: 0.5rem;
  }

  .dark {
    /* MODO ESCURO */
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%; /* Azul mais vibrante para contraste no dark */
    --primary-foreground: 222.2 47.4% 11.2%;
  }
}
2. O Código do Componente (Limpo e Semântico)
Como você quer modularização e detesta o código "sujo", nós usamos a técnica de Abstração de Componentes. O seu arquivo de página não vê Tailwind, ele vê apenas componentes semânticos.

❌ O que evitar (Tailwind misturado):

TypeScript

<button className="bg-blue-600 dark:bg-blue-400 text-white p-4 rounded-lg">
  Novo Pedido
</button>
✅ Como faremos com shadcn/ui (Sênior): O shadcn já te entrega o componente Button configurado. Você apenas o utiliza. O estilo "Dark Mode" já está embutido na variável --primary que definimos acima.

TypeScript

import { Button } from "@/components/ui/button"

export function SalesActions() {
  return (
    <div className="flex gap-4">
      {/* O componente sabe se deve ser claro ou escuro sozinho */}
      <Button variant="default">Novo Pedido</Button>
      <Button variant="outline">Gerar Orçamento</Button>
    </div>
  )
}
3. Gerenciamento de Cores Customizadas
Se você quiser criar arquivos de configuração para cores específicas da sua marca (ex: cores-grafica-viana.ts), você pode integrar o Tailwind com variáveis CSS no arquivo tailwind.config.js.

Isso permite que você use nomes amigáveis no código:

JavaScript

// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        // Agora você pode usar "bg-brand-gold" se quiser
        brand: {
          gold: "var(--brand-gold)",
          silver: "var(--brand-silver)",
        },
      },
    },
  },
}
4. Como Alternar o Tema (Theming)
No shadcn/ui, usamos geralmente o next-themes (ou um provider similar em Vite) que adiciona a classe .dark ao elemento <html>.

TypeScript

import { useTheme } from "next-themes"

export function ModeToggle() {
  const { setTheme, theme } = useTheme()

  return (
    <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
      Alternar Tema
    </button>
  )
}
5. Veredito Técnico: shadcn/ui vs Sujeira no Código
Para manter o shadcn/ui organizado como você deseja:

Encapsulamento: Nunca use classes utilitárias para cores de marca nas páginas. Use as variáveis de tema (primary, secondary, accent) que o shadcn provê.

Configuração: Se precisar mudar o visual do sistema inteiro para um cliente, você altera apenas o arquivo globals.css (CSS Variables).

Componentização: Se um grupo de estilos se repete, ele deve virar um componente na pasta @/components/ui.

Conclusão: O shadcn/ui permite um código muito limpo se você for disciplinado. A "sujeira" do Tailwind fica escondida dentro dos arquivos da pasta ui/ (que você raramente abre após configurar), deixando seus arquivos de lógica de negócio (modules/sales, modules/inventory) focados apenas na função e não na forma.