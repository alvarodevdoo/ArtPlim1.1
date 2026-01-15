import { PrismaClient } from '@prisma/client';
import { ProductComponentService } from '../src/modules/catalog/services/ProductComponentService';

const prisma = new PrismaClient();

async function testApiComponents() {
  console.log('🧪 Testando API de componentes...');

  try {
    // Buscar um produto que tem componentes
    const productWithComponents = await prisma.product.findFirst({
      where: {
        components: {
          some: {}
        }
      },
      include: {
        components: {
          include: {
            material: true
          }
        }
      }
    });

    if (!productWithComponents) {
      console.log('❌ Nenhum produto com componentes encontrado');
      return;
    }

    console.log(`📦 Testando produto: ${productWithComponents.name} (ID: ${productWithComponents.id})`);
    console.log(`🔗 Componentes no banco: ${productWithComponents.components.length}`);

    // Testar o service
    const componentService = new ProductComponentService(prisma);
    const components = await componentService.listComponents(productWithComponents.id);

    console.log('\n📋 Componentes retornados pela API:');
    console.log(`📊 Total: ${components.length}`);
    
    components.forEach((comp, index) => {
      console.log(`\n  ${index + 1}. ${comp.material.name}`);
      console.log(`     - ID: ${comp.id}`);
      console.log(`     - Material ID: ${comp.materialId}`);
      console.log(`     - Método: ${comp.consumptionMethod}`);
      console.log(`     - Perda: ${comp.wastePercentage * 100}%`);
      console.log(`     - Custo: R$ ${comp.material.costPerUnit}/${comp.material.unit}`);
      console.log(`     - Estoque: ${comp.material.currentStock || 'N/A'}`);
      console.log(`     - Formato: ${comp.material.format}`);
      if (comp.material.standardWidth && comp.material.standardLength) {
        console.log(`     - Dimensões: ${comp.material.standardWidth} × ${comp.material.standardLength}mm`);
      }
    });

    // Testar com produto sem componentes
    const productWithoutComponents = await prisma.product.findFirst({
      where: {
        components: {
          none: {}
        }
      }
    });

    if (productWithoutComponents) {
      console.log(`\n🔍 Testando produto sem componentes: ${productWithoutComponents.name}`);
      const emptyComponents = await componentService.listComponents(productWithoutComponents.id);
      console.log(`📊 Componentes retornados: ${emptyComponents.length}`);
    }

    console.log('\n✅ Teste da API concluído!');

  } catch (error) {
    console.error('❌ Erro no teste:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testApiComponents();