import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testApiRoute() {
  console.log('🧪 Testando rota da API diretamente...');

  try {
    // Simular o que a rota faz
    const products = await prisma.product.findMany({
      where: {
        active: true
      },
      include: {
        components: {
          include: {
            material: {
              select: {
                id: true,
                name: true,
                format: true,
                costPerUnit: true,
                unit: true
              }
            }
          }
        },
        operations: true,
        _count: {
          select: {
            orderItems: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    console.log(`📦 Total de produtos ativos: ${products.length}`);
    
    // Verificar cartões de visita
    const cartoes = products.filter(p => p.name.toLowerCase().includes('cartão'));
    console.log(`🎴 Cartões de visita: ${cartoes.length}`);
    
    cartoes.forEach((cartao, index) => {
      console.log(`\n=== CARTÃO ${index + 1} ===`);
      console.log(`📦 Nome: ${cartao.name}`);
      console.log(`🆔 ID: ${cartao.id}`);
      console.log(`💰 Preço: R$ ${cartao.salePrice || 'N/A'}`);
      console.log(`🔧 Componentes incluídos: ${cartao.components?.length || 0}`);
      console.log(`📊 Ativo: ${cartao.active}`);
      
      if (cartao.components && cartao.components.length > 0) {
        console.log('📋 Componentes:');
        cartao.components.forEach((comp, i) => {
          console.log(`  ${i + 1}. ${comp.material.name}`);
          console.log(`     - ID: ${comp.id}`);
          console.log(`     - Material ID: ${comp.materialId}`);
        });
      }
    });

    // Verificar estrutura de um produto com componentes
    const produtoComComponentes = products.find(p => p.components && p.components.length > 0);
    if (produtoComComponentes) {
      console.log('\n🔍 Estrutura de produto com componentes:');
      console.log(JSON.stringify({
        id: produtoComComponentes.id,
        name: produtoComComponentes.name,
        components: produtoComComponentes.components?.map(c => ({
          id: c.id,
          materialId: c.materialId,
          material: c.material
        }))
      }, null, 2));
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testApiRoute();