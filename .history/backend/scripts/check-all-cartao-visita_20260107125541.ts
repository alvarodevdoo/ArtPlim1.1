import { PrismaClient } from '@prisma/client';
import { ProductComponentService } from '../src/modules/catalog/services/ProductComponentService';

const prisma = new PrismaClient();

async function checkAllCartaoVisita() {
  console.log('🔍 Verificando TODOS os Cartões de Visita...');

  try {
    // Buscar TODOS os produtos Cartão de Visita
    const cartoes = await prisma.product.findMany({
      where: {
        name: {
          contains: 'Cartão',
          mode: 'insensitive'
        }
      },
      include: {
        components: {
          include: {
            material: {
              include: {
                inventoryItems: true
              }
            }
          }
        }
      }
    });

    console.log(`📦 Total de produtos encontrados: ${cartoes.length}`);

    for (let i = 0; i < cartoes.length; i++) {
      const cartao = cartoes[i];
      console.log(`\n=== PRODUTO ${i + 1} ===`);
      console.log(`📦 Nome: ${cartao.name}`);
      console.log(`🆔 ID: ${cartao.id}`);
      console.log(`🔧 Componentes: ${cartao.components.length}`);
      console.log(`💰 Preço: R$ ${cartao.salePrice || 'N/A'}`);
      console.log(`📊 Modo: ${cartao.pricingMode}`);
      console.log(`📅 Criado: ${cartao.createdAt.toISOString().split('T')[0]}`);

      if (cartao.components.length > 0) {
        console.log('\n📋 Materiais configurados:');
        cartao.components.forEach((comp, index) => {
          console.log(`  ${index + 1}. ${comp.material.name}`);
          console.log(`     - Método: ${comp.consumptionMethod}`);
          console.log(`     - Perda: ${comp.wastePercentage * 100}%`);
          console.log(`     - Custo: R$ ${comp.material.costPerUnit}/${comp.material.unit}`);
          console.log(`     - Prioridade: ${comp.priority}`);
        });

        // Testar API para este produto
        console.log('\n🧪 Testando API...');
        const componentService = new ProductComponentService(prisma);
        const apiComponents = await componentService.listComponents(cartao.id);
        console.log(`📊 API retornou: ${apiComponents.length} componentes`);
      } else {
        console.log('⚠️ Nenhum material configurado');
      }
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllCartaoVisita();