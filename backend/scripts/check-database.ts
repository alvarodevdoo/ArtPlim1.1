import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDatabase() {
  console.log('🔍 Verificando dados no banco...');

  try {
    // Verificar produtos
    const products = await prisma.product.findMany({
      include: {
        components: {
          include: {
            material: true
          }
        }
      }
    });

    console.log(`📦 Total de produtos: ${products.length}`);
    
    // Verificar materiais
    const materials = await prisma.material.findMany();
    console.log(`🧱 Total de materiais: ${materials.length}`);

    // Verificar componentes
    const components = await prisma.productComponent.findMany({
      include: {
        material: true,
        product: true
      }
    });
    console.log(`🔗 Total de componentes: ${components.length}`);

    // Mostrar produtos com componentes
    const productsWithComponents = products.filter(p => p.components.length > 0);
    console.log(`✅ Produtos com componentes: ${productsWithComponents.length}`);

    if (productsWithComponents.length > 0) {
      console.log('\n📋 Produtos com materiais configurados:');
      productsWithComponents.forEach(product => {
        console.log(`  - ${product.name} (${product.components.length} materiais)`);
        product.components.forEach(comp => {
          console.log(`    • ${comp.material.name} - ${comp.consumptionMethod}`);
        });
      });
    }

    // Mostrar alguns materiais
    if (materials.length > 0) {
      console.log('\n🧱 Materiais disponíveis:');
      materials.slice(0, 5).forEach(material => {
        console.log(`  - ${material.name} (${material.format}) - R$ ${material.costPerUnit}/${material.unit}`);
      });
      if (materials.length > 5) {
        console.log(`  ... e mais ${materials.length - 5} materiais`);
      }
    }

  } catch (error) {
    console.error('❌ Erro ao verificar banco:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();