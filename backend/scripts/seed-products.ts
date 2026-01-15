import { PrismaClient, PricingMode, MaterialFormat } from '@prisma/client';

const prisma = new PrismaClient();

async function seedProducts() {
  console.log('🌱 Iniciando seed de produtos e materiais...');

  // Buscar primeira organização para usar como exemplo
  const organization = await prisma.organization.findFirst();
  if (!organization) {
    console.error('❌ Nenhuma organização encontrada. Execute o seed de organizações primeiro.');
    return;
  }

  console.log(`📋 Usando organização: ${organization.name}`);

  // 1. MATERIAIS
  const materials = [
    // Vinis e Lonas
    { name: 'Vinil Adesivo Branco', format: 'ROLL' as MaterialFormat, costPerUnit: 12.50, unit: 'm²' },
    { name: 'Vinil Adesivo Transparente', format: 'ROLL' as MaterialFormat, costPerUnit: 15.80, unit: 'm²' },
    { name: 'Vinil Recortado Preto', format: 'ROLL' as MaterialFormat, costPerUnit: 18.90, unit: 'm²' },
    { name: 'Lona Frontlit 440g', format: 'ROLL' as MaterialFormat, costPerUnit: 8.90, unit: 'm²' },
    { name: 'Lona Blackout 510g', format: 'ROLL' as MaterialFormat, costPerUnit: 11.50, unit: 'm²' },
    { name: 'Lona Mesh 280g', format: 'ROLL' as MaterialFormat, costPerUnit: 9.80, unit: 'm²' },
    
    // Papéis
    { name: 'Papel Couché 115g', format: 'SHEET' as MaterialFormat, costPerUnit: 0.85, unit: 'folha' },
    { name: 'Papel Couché 170g', format: 'SHEET' as MaterialFormat, costPerUnit: 1.20, unit: 'folha' },
    { name: 'Papel Offset 75g', format: 'SHEET' as MaterialFormat, costPerUnit: 0.45, unit: 'folha' },
    { name: 'Papel Fotográfico', format: 'SHEET' as MaterialFormat, costPerUnit: 2.80, unit: 'folha' },
    
    // ACM e Chapas
    { name: 'ACM 3mm Branco', format: 'SHEET' as MaterialFormat, costPerUnit: 45.00, unit: 'm²' },
    { name: 'ACM 3mm Prata', format: 'SHEET' as MaterialFormat, costPerUnit: 48.00, unit: 'm²' },
    { name: 'Chapa Galvanizada', format: 'SHEET' as MaterialFormat, costPerUnit: 35.00, unit: 'm²' },
    { name: 'PVC Expandido 3mm', format: 'SHEET' as MaterialFormat, costPerUnit: 28.50, unit: 'm²' },
    { name: 'PVC Expandido 5mm', format: 'SHEET' as MaterialFormat, costPerUnit: 42.00, unit: 'm²' },
    
    // Tintas e Consumíveis
    { name: 'Tinta Solvente CMYK', format: 'UNIT' as MaterialFormat, costPerUnit: 180.00, unit: 'litro' },
    { name: 'Tinta Eco-Solvente', format: 'UNIT' as MaterialFormat, costPerUnit: 220.00, unit: 'litro' },
    { name: 'Tinta UV', format: 'UNIT' as MaterialFormat, costPerUnit: 350.00, unit: 'litro' },
    { name: 'Laminação Brilho', format: 'ROLL' as MaterialFormat, costPerUnit: 6.50, unit: 'm²' },
    { name: 'Laminação Fosca', format: 'ROLL' as MaterialFormat, costPerUnit: 7.20, unit: 'm²' },
  ];

  console.log('📦 Criando materiais...');
  const createdMaterials = [];
  for (const material of materials) {
    const created = await prisma.material.create({
      data: {
        name: material.name,
        format: material.format,
        costPerUnit: material.costPerUnit,
        unit: material.unit,
        organizationId: organization.id,
        description: `Material para produção gráfica - ${material.name}`,
        active: true
      }
    });
    createdMaterials.push(created);
  }

  // 2. PRODUTOS
  const products = [
    // ADESIVOS E VINIS
    {
      name: 'Adesivo Recortado',
      description: 'Adesivo personalizado recortado em vinil',
      category: 'Adesivos',
      pricingMode: 'DYNAMIC_ENGINEER' as PricingMode,
      markup: 3.5,
      minPrice: 15.00,
      materials: ['Vinil Recortado Preto'],
      operations: ['Plotagem', 'Recorte']
    },
    {
      name: 'Adesivo Impresso',
      description: 'Adesivo com impressão digital colorida',
      category: 'Adesivos',
      pricingMode: 'SIMPLE_AREA' as PricingMode,
      salePrice: 25.00,
      minPrice: 10.00,
      materials: ['Vinil Adesivo Branco', 'Laminação Brilho'],
      operations: ['Impressão Digital', 'Laminação']
    },
    {
      name: 'Adesivo Jateado',
      description: 'Adesivo jateado para vidros',
      category: 'Adesivos',
      pricingMode: 'SIMPLE_AREA' as PricingMode,
      salePrice: 35.00,
      minPrice: 20.00,
      materials: ['Vinil Adesivo Transparente'],
      operations: ['Plotagem', 'Aplicação']
    },

    // BANNERS E LONAS
    {
      name: 'Banner Lona',
      description: 'Banner em lona com impressão digital',
      category: 'Banners',
      pricingMode: 'DYNAMIC_ENGINEER' as PricingMode,
      markup: 2.8,
      minPrice: 25.00,
      materials: ['Lona Frontlit 440g'],
      operations: ['Impressão Digital', 'Acabamento']
    },
    {
      name: 'Banner Mesh',
      description: 'Banner perfurado para fachadas',
      category: 'Banners',
      pricingMode: 'SIMPLE_AREA' as PricingMode,
      salePrice: 18.00,
      minPrice: 15.00,
      materials: ['Lona Mesh 280g'],
      operations: ['Impressão Digital', 'Acabamento']
    },
    {
      name: 'Faixa Publicitária',
      description: 'Faixa em lona para eventos',
      category: 'Banners',
      pricingMode: 'SIMPLE_AREA' as PricingMode,
      salePrice: 22.00,
      minPrice: 18.00,
      materials: ['Lona Frontlit 440g'],
      operations: ['Impressão Digital', 'Acabamento', 'Ilhoses']
    },

    // PLACAS E SINALIZAÇÃO
    {
      name: 'Placa ACM',
      description: 'Placa em ACM com impressão',
      category: 'Placas',
      pricingMode: 'DYNAMIC_ENGINEER' as PricingMode,
      markup: 3.2,
      minPrice: 80.00,
      materials: ['ACM 3mm Branco', 'Vinil Adesivo Branco'],
      operations: ['Impressão Digital', 'Aplicação', 'Corte CNC']
    },
    {
      name: 'Placa PVC',
      description: 'Placa em PVC expandido',
      category: 'Placas',
      pricingMode: 'DYNAMIC_ENGINEER' as PricingMode,
      markup: 2.9,
      minPrice: 45.00,
      materials: ['PVC Expandido 3mm'],
      operations: ['Impressão UV', 'Corte CNC']
    },
    {
      name: 'Placa Galvanizada',
      description: 'Placa em chapa galvanizada',
      category: 'Placas',
      pricingMode: 'SIMPLE_AREA' as PricingMode,
      salePrice: 65.00,
      minPrice: 50.00,
      materials: ['Chapa Galvanizada'],
      operations: ['Impressão Serigrafia', 'Acabamento']
    },

    // IMPRESSOS
    {
      name: 'Cartão de Visita',
      description: 'Cartão de visita em couché 300g',
      category: 'Impressos',
      pricingMode: 'SIMPLE_UNIT' as PricingMode,
      salePrice: 0.35,
      minPrice: 0.25,
      materials: ['Papel Couché 170g'],
      operations: ['Impressão Offset', 'Corte']
    },
    {
      name: 'Flyer A5',
      description: 'Flyer colorido formato A5',
      category: 'Impressos',
      pricingMode: 'SIMPLE_UNIT' as PricingMode,
      salePrice: 0.85,
      minPrice: 0.60,
      materials: ['Papel Couché 115g'],
      operations: ['Impressão Digital', 'Corte']
    },
    {
      name: 'Folder Institucional',
      description: 'Folder dobrado em 3 partes',
      category: 'Impressos',
      pricingMode: 'SIMPLE_UNIT' as PricingMode,
      salePrice: 2.50,
      minPrice: 1.80,
      materials: ['Papel Couché 170g'],
      operations: ['Impressão Digital', 'Dobra', 'Acabamento']
    },
    {
      name: 'Catálogo A4',
      description: 'Catálogo grampeado 8 páginas',
      category: 'Impressos',
      pricingMode: 'SIMPLE_UNIT' as PricingMode,
      salePrice: 4.50,
      minPrice: 3.20,
      materials: ['Papel Couché 115g'],
      operations: ['Impressão Digital', 'Dobra', 'Grampo']
    },

    // SERVIÇOS
    {
      name: 'Criação de Arte',
      description: 'Desenvolvimento de arte personalizada',
      category: 'Serviços',
      pricingMode: 'SIMPLE_UNIT' as PricingMode,
      salePrice: 80.00,
      minPrice: 50.00,
      materials: [],
      operations: ['Design Gráfico']
    },
    {
      name: 'Montagem de Arte',
      description: 'Montagem e finalização de arquivo',
      category: 'Serviços',
      pricingMode: 'SIMPLE_UNIT' as PricingMode,
      salePrice: 35.00,
      minPrice: 25.00,
      materials: [],
      operations: ['Design Gráfico']
    },
    {
      name: 'Aplicação de Adesivo',
      description: 'Serviço de aplicação em campo',
      category: 'Serviços',
      pricingMode: 'SIMPLE_AREA' as PricingMode,
      salePrice: 15.00,
      minPrice: 10.00,
      materials: [],
      operations: ['Aplicação']
    },
    {
      name: 'Instalação de Placa',
      description: 'Instalação de placa com fixação',
      category: 'Serviços',
      pricingMode: 'SIMPLE_UNIT' as PricingMode,
      salePrice: 120.00,
      minPrice: 80.00,
      materials: [],
      operations: ['Instalação']
    },

    // PRODUTOS ESPECIAIS
    {
      name: 'Painel Fotográfico',
      description: 'Painel em papel fotográfico',
      category: 'Painéis',
      pricingMode: 'SIMPLE_AREA' as PricingMode,
      salePrice: 45.00,
      minPrice: 35.00,
      materials: ['Papel Fotográfico'],
      operations: ['Impressão Fotográfica', 'Acabamento']
    },
    {
      name: 'Backdrop',
      description: 'Fundo fotográfico em lona',
      category: 'Painéis',
      pricingMode: 'SIMPLE_AREA' as PricingMode,
      salePrice: 28.00,
      minPrice: 22.00,
      materials: ['Lona Frontlit 440g'],
      operations: ['Impressão Digital', 'Acabamento']
    },
    {
      name: 'Adesivo Piso',
      description: 'Adesivo antiderrapante para piso',
      category: 'Adesivos',
      pricingMode: 'SIMPLE_AREA' as PricingMode,
      salePrice: 42.00,
      minPrice: 35.00,
      materials: ['Vinil Adesivo Branco', 'Laminação Fosca'],
      operations: ['Impressão Digital', 'Laminação']
    },
    {
      name: 'Letra Caixa',
      description: 'Letra em ACM com LED',
      category: 'Sinalização',
      pricingMode: 'SIMPLE_UNIT' as PricingMode,
      salePrice: 85.00,
      minPrice: 65.00,
      materials: ['ACM 3mm Branco'],
      operations: ['Corte CNC', 'Montagem', 'Instalação']
    }
  ];

  console.log('🎨 Criando produtos...');
  for (const product of products) {
    const created = await prisma.product.create({
      data: {
        name: product.name,
        description: product.description,
        pricingMode: product.pricingMode,
        salePrice: product.salePrice,
        minPrice: product.minPrice,
        markup: product.markup || 2.5,
        organizationId: organization.id,
        active: true
      }
    });

    // Adicionar componentes (materiais)
    if (product.materials.length > 0) {
      for (const materialName of product.materials) {
        const material = createdMaterials.find(m => m.name === materialName);
        if (material) {
          await prisma.productComponent.create({
            data: {
              productId: created.id,
              materialId: material.id,
              consumptionMethod: material.format === 'ROLL' ? 'BOUNDING_BOX' : 
                               material.format === 'SHEET' ? 'BOUNDING_BOX' : 'FIXED_AMOUNT',
              wastePercentage: 0.1 // 10% de perda padrão
            }
          });
        }
      }
    }

    // Adicionar operações
    if (product.operations.length > 0) {
      for (const operationName of product.operations) {
        const operationCosts = {
          'Plotagem': 2.50,
          'Recorte': 1.80,
          'Impressão Digital': 3.20,
          'Impressão UV': 4.50,
          'Impressão Offset': 1.20,
          'Impressão Serigrafia': 2.80,
          'Impressão Fotográfica': 5.00,
          'Laminação': 1.50,
          'Aplicação': 8.00,
          'Acabamento': 2.00,
          'Corte': 0.80,
          'Corte CNC': 12.00,
          'Dobra': 0.60,
          'Grampo': 0.40,
          'Ilhoses': 1.20,
          'Design Gráfico': 45.00,
          'Instalação': 25.00,
          'Montagem': 15.00
        };

        await prisma.productOperation.create({
          data: {
            productId: created.id,
            name: operationName,
            costPerMinute: operationCosts[operationName as keyof typeof operationCosts] || 2.00,
            setupTime: operationName.includes('Impressão') ? 15 : 
                      operationName.includes('Corte') ? 10 : 5
          }
        });
      }
    }

    console.log(`✅ Produto criado: ${product.name}`);
  }

  console.log('🎉 Seed concluído com sucesso!');
  console.log(`📊 Criados: ${createdMaterials.length} materiais e ${products.length} produtos`);
}

seedProducts()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });