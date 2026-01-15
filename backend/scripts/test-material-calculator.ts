import { PrismaClient } from '@prisma/client';
import { ProductComponentService } from '../src/modules/catalog/services/ProductComponentService';
import { PricingEngine } from '../src/shared/application/pricing/PricingEngine';

const prisma = new PrismaClient();

async function testMaterialCalculator() {
  console.log('🧪 Testando integração MaterialCalculator...');

  try {
    // 1. Buscar um produto com modo DYNAMIC_ENGINEER
    const product = await prisma.product.findFirst({
      where: {
        pricingMode: 'DYNAMIC_ENGINEER'
      },
      include: {
        components: {
          include: {
            material: true
          }
        }
      }
    });

    if (!product) {
      console.log('❌ Nenhum produto DYNAMIC_ENGINEER encontrado');
      return;
    }

    console.log(`📦 Produto encontrado: ${product.name}`);
    console.log(`🔧 Componentes: ${product.components.length}`);

    // 2. Testar ProductComponentService
    const componentService = new ProductComponentService(prisma);
    const components = await componentService.listComponents(product.id);
    
    console.log('\n📋 Componentes do produto:');
    components.forEach((comp, index) => {
      console.log(`  ${index + 1}. ${comp.material.name}`);
      console.log(`     - Método: ${comp.consumptionMethod}`);
      console.log(`     - Perda: ${comp.wastePercentage * 100}%`);
      console.log(`     - Custo: R$ ${comp.material.costPerUnit}/${comp.material.unit}`);
    });

    // 3. Testar PricingEngine
    const pricingEngine = new PricingEngine();
    
    const testInput = {
      product: {
        id: product.id,
        name: product.name,
        pricingMode: product.pricingMode,
        salePrice: product.salePrice,
        minPrice: product.minPrice,
        markup: product.markup
      },
      width: 300,  // 30cm
      height: 200, // 20cm  
      quantity: 10,
      configurations: {},
      organizationSettings: {
        enableEngineering: true,
        defaultMarkup: 2.5
      }
    };

    console.log('\n💰 Testando cálculo de preço:');
    console.log(`📏 Dimensões: ${testInput.width}mm × ${testInput.height}mm`);
    console.log(`📊 Quantidade: ${testInput.quantity} unidades`);

    const result = await pricingEngine.execute(testInput);
    
    console.log('\n🎯 Resultado do cálculo:');
    console.log(`💵 Custo: R$ ${result.costPrice.toFixed(2)}`);
    console.log(`💲 Preço calculado: R$ ${result.calculatedPrice.toFixed(2)}`);
    console.log(`💰 Preço final: R$ ${result.unitPrice.toFixed(2)}`);
    
    if (result.materials) {
      console.log('\n📦 Materiais calculados:');
      result.materials.forEach((mat, index) => {
        console.log(`  ${index + 1}. ${mat.name}`);
        console.log(`     - Necessário: ${mat.needed.toFixed(2)} ${mat.unit}`);
        console.log(`     - Custo: R$ ${mat.cost.toFixed(2)}`);
        console.log(`     - Perda aplicada: ${mat.wasteApplied.toFixed(1)}%`);
      });
    }

    console.log('\n📝 Log detalhado:');
    result.details.forEach((detail, index) => {
      console.log(`  ${index + 1}. ${detail}`);
    });

    // 4. Testar com produto sem componentes
    console.log('\n🔍 Testando produto sem componentes...');
    
    const simpleProduct = await prisma.product.findFirst({
      where: {
        pricingMode: 'SIMPLE_AREA'
      }
    });

    if (simpleProduct) {
      const simpleInput = {
        product: {
          id: simpleProduct.id,
          name: simpleProduct.name,
          pricingMode: simpleProduct.pricingMode,
          salePrice: simpleProduct.salePrice,
          minPrice: simpleProduct.minPrice,
          markup: simpleProduct.markup
        },
        width: 300,
        height: 200,
        quantity: 10,
        configurations: {}
      };

      const simpleResult = await pricingEngine.execute(simpleInput);
      console.log(`📦 Produto simples: ${simpleProduct.name}`);
      console.log(`💰 Preço: R$ ${simpleResult.unitPrice.toFixed(2)}`);
    }

    console.log('\n✅ Teste concluído com sucesso!');

  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

testMaterialCalculator()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });