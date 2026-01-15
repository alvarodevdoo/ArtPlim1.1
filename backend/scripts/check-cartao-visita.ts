import { PrismaClient } from '@prisma/client';
import { ProductComponentService } from '../src/modules/catalog/services/ProductComponentService';

const prisma = new PrismaClient();

async function checkCartaoVisita() {
  console.log('🔍 Verificando Cartão de Visita...');

  try {
    // Buscar produto Cartão de Visita
    const cartaoVisita = await prisma.product.findFirst({
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

    if (!cartaoVisita) {
      console.log('❌ Produto Cartão de Visita não encontrado');
      return;
    }

    console.log(`📦 Produto encontrado: ${cartaoVisita.name}`);
    console.log(`🆔 ID: ${cartaoVisita.id}`);
    console.log(`🔧 Componentes no banco: ${cartaoVisita.components.length}`);

    console.log('\n📋 Componentes detalhados:');
    cartaoVisita.components.forEach((comp, index) => {
      console.log(`\n  ${index + 1}. ${comp.material.name}`);
      console.log(`     - ID Componente: ${comp.id}`);
      console.log(`     - Material ID: ${comp.materialId}`);
      console.log(`     - Método: ${comp.consumptionMethod}`);
      console.log(`     - Perda: ${comp.wastePercentage * 100}%`);
      console.log(`     - Custo: R$ ${comp.material.costPerUnit}/${comp.material.unit}`);
      console.log(`     - Formato: ${comp.material.format}`);
      console.log(`     - Prioridade: ${comp.priority}`);
      console.log(`     - Opcional: ${comp.isOptional}`);
      console.log(`     - Itens inventário: ${comp.material.inventoryItems.length}`);
      
      if (comp.material.standardWidth && comp.material.standardLength) {
        console.log(`     - Dimensões: ${comp.material.standardWidth} × ${comp.material.standardLength}mm`);
      }
    });

    // Testar a API
    console.log('\n🧪 Testando API...');
    const componentService = new ProductComponentService(prisma);
    const apiComponents = await componentService.listComponents(cartaoVisita.id);
    
    console.log(`📊 API retornou: ${apiComponents.length} componentes`);
    
    apiComponents.forEach((comp, index) => {
      console.log(`\n  API ${index + 1}. ${comp.material.name}`);
      console.log(`     - Estoque calculado: ${comp.material.currentStock}`);
      console.log(`     - Custo: R$ ${comp.material.costPerUnit}`);
    });

    // Verificar se há outros produtos com nome similar
    const similarProducts = await prisma.product.findMany({
      where: {
        name: {
          contains: 'visita',
          mode: 'insensitive'
        }
      },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            components: true
          }
        }
      }
    });

    console.log('\n🔍 Produtos similares:');
    similarProducts.forEach(product => {
      console.log(`  - ${product.name} (${product._count.components} componentes)`);
    });

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCartaoVisita();