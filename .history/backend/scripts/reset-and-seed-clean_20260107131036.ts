import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetAndSeedClean() {
  console.log('🧹 Limpando banco de dados...');

  try {
    // Limpar dados existentes (ordem importante por causa das foreign keys)
    await prisma.productionWaste.deleteMany();
    await prisma.inventoryMovement.deleteMany();
    await prisma.inventoryItem.deleteMany();
    await prisma.productComponent.deleteMany();
    await prisma.configurationOption.deleteMany();
    await prisma.productConfiguration.deleteMany();
    await prisma.orderItemConfiguration.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.productStandardSize.deleteMany();
    await prisma.productOperation.deleteMany();
    await prisma.product.deleteMany();
    await prisma.material.deleteMany();
    await prisma.inventoryAlert.deleteMany();

    console.log('✅ Banco limpo!');

    // Buscar organização existente
    const organization = await prisma.organization.findFirst();
    if (!organization) {
      throw new Error('Nenhuma organização encontrada');
    }

    console.log('📦 Criando materiais...');

    // 1. MATERIAIS - Um de cada tipo
    const materials = await Promise.all([
      // SHEET - Folhas/Chapas
      prisma.material.create({
        data: {
          organizationId: organization.id,
          name: 'Papel A4 75g',
          description: 'Papel sulfite A4 para impressão',
          format: 'SHEET',
          costPerUnit: 0.15,
          unit: 'folha',
          standardWidth: 210,
          standardLength: 297
        }
      }),

      // ROLL - Rolos
      prisma.material.create({
        data: {
          organizationId: organization.id,
          name: 'Vinil Adesivo',
          description: 'Vinil adesivo para impressão digital',
          format: 'ROLL',
          costPerUnit: 12.50,
          unit: 'm²',
          standardWidth: 1370,
          standardLength: null
        }
      }),

      // UNIT - Unidades
      prisma.material.create({
        data: {
          organizationId: organization.id,
          name: 'Tinta Digital',
          description: 'Tinta para impressão digital',
          format: 'UNIT',
          costPerUnit: 0.05,
          unit: 'ml',
          standardWidth: null,
          standardLength: null
        }
      })
    ]);

    console.log('✅ Materiais criados:', materials.length);

    // 2. PRODUTOS - Um para cada modo de precificação
    console.log('📦 Criando produtos...');

    const products = await Promise.all([
      // SIMPLE_AREA - Produto por m²
      prisma.product.create({
        data: {
          organizationId: organization.id,
          name: 'Banner Impresso',
          description: 'Banner em vinil para impressão digital',
          pricingMode: 'SIMPLE_AREA',
          salePrice: 25.00,
          minPrice: 15.00,
          markup: 2.0,
          active: true
        }
      }),

      // SIMPLE_UNIT - Produto por unidade
      prisma.product.create({
        data: {
          organizationId: organization.id,
          name: 'Cartão de Visita',
          description: 'Cartão de visita em papel couché',
          pricingMode: 'SIMPLE_UNIT',
          salePrice: 0.50,
          minPrice: 0.30,
          markup: 2.5,
          active: true
        }
      }),

      // DYNAMIC_ENGINEER - Produto com cálculo dinâmico
      prisma.product.create({
        data: {
          organizationId: organization.id,
          name: 'Projeto Personalizado',
          description: 'Projeto com cálculo de materiais e tempo',
          pricingMode: 'DYNAMIC_ENGINEER',
          salePrice: null,
          minPrice: 50.00,
          markup: 3.0,
          active: true
        }
      })
    ]);

    console.log('✅ Produtos criados:', products.length);

    // 3. COMPONENTES - Vincular materiais aos produtos
    console.log('🔗 Vinculando materiais aos produtos...');

    const components = await Promise.all([
      // Banner (SIMPLE_AREA) usa Vinil (ROLL) - BOUNDING_BOX
      prisma.productComponent.create({
        data: {
          productId: products[0].id, // Banner
          materialId: materials[1].id, // Vinil Adesivo
          consumptionMethod: 'BOUNDING_BOX',
          wastePercentage: 0.10, // 10% de perda
          calculatedWastePercentage: 0.08,
          isOptional: false,
          priority: 1,
          notes: 'Material principal para impressão'
        }
      }),

      // Cartão (SIMPLE_UNIT) usa Papel (SHEET) - BOUNDING_BOX
      prisma.productComponent.create({
        data: {
          productId: products[1].id, // Cartão de Visita
          materialId: materials[0].id, // Papel A4
          consumptionMethod: 'BOUNDING_BOX',
          wastePercentage: 0.05, // 5% de perda
          calculatedWastePercentage: 0.05,
          isOptional: false,
          priority: 1,
          notes: 'Papel para impressão dos cartões'
        }
      }),

      // Projeto (DYNAMIC_ENGINEER) usa Tinta (UNIT) - FIXED_AMOUNT
      prisma.productComponent.create({
        data: {
          productId: products[2].id, // Projeto Personalizado
          materialId: materials[2].id, // Tinta Digital
          consumptionMethod: 'FIXED_AMOUNT',
          wastePercentage: 0.02, // 2% de perda
          calculatedWastePercentage: 0.02,
          isOptional: false,
          priority: 1,
          notes: 'Tinta necessária para impressão'
        }
      })
    ]);

    console.log('✅ Componentes criados:', components.length);

    // 4. ESTOQUE - Adicionar itens de inventário
    console.log('📦 Criando estoque...');

    const inventoryItems = await Promise.all([
      // Estoque de Papel A4
      prisma.inventoryItem.create({
        data: {
          materialId: materials[0].id,
          width: 210,
          length: 297,
          height: 0.1,
          quantity: 1000, // 1000 folhas
          location: 'Estoque A1'
        }
      }),

      // Estoque de Vinil (rolo)
      prisma.inventoryItem.create({
        data: {
          materialId: materials[1].id,
          width: 1370,
          length: 50000, // 50 metros
          height: 0.1,
          quantity: 1, // 1 rolo
          location: 'Estoque B1'
        }
      }),

      // Estoque de Tinta
      prisma.inventoryItem.create({
        data: {
          materialId: materials[2].id,
          width: 100,
          length: 100,
          height: 200,
          quantity: 5000, // 5000ml
          location: 'Estoque C1'
        }
      })
    ]);

    console.log('✅ Estoque criado:', inventoryItems.length);

    // 5. RESUMO FINAL
    console.log('\n🎉 BANCO POPULADO COM SUCESSO!');
    console.log('\n📋 RESUMO:');
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│                      MATERIAIS                          │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log('│ 1. Papel A4 75g (SHEET) - R$ 0,15/folha               │');
    console.log('│ 2. Vinil Adesivo (ROLL) - R$ 12,50/m²                 │');
    console.log('│ 3. Tinta Digital (UNIT) - R$ 0,05/ml                  │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log('│                      PRODUTOS                           │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log('│ 1. Banner Impresso (SIMPLE_AREA) → Vinil Adesivo      │');
    console.log('│    Método: BOUNDING_BOX, Perda: 10%                   │');
    console.log('│                                                         │');
    console.log('│ 2. Cartão de Visita (SIMPLE_UNIT) → Papel A4          │');
    console.log('│    Método: BOUNDING_BOX, Perda: 5%                    │');
    console.log('│                                                         │');
    console.log('│ 3. Projeto Personalizado (DYNAMIC_ENGINEER) → Tinta   │');
    console.log('│    Método: FIXED_AMOUNT, Perda: 2%                    │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log('│                      ESTOQUE                            │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log('│ • Papel A4: 1000 folhas                               │');
    console.log('│ • Vinil Adesivo: 1 rolo (50m)                         │');
    console.log('│ • Tinta Digital: 5000ml                               │');
    console.log('└─────────────────────────────────────────────────────────┘');

    console.log('\n✅ Agora você pode testar:');
    console.log('1. MaterialCalculator com dados reais');
    console.log('2. Página de produtos mostrando materiais');
    console.log('3. Cada tipo de consumo (BOUNDING_BOX, FIXED_AMOUNT)');
    console.log('4. Cada formato de material (SHEET, ROLL, UNIT)');

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetAndSeedClean();