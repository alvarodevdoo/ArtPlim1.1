import { PrismaClient } from '@prisma/client';
import { ProductService } from '../src/modules/catalog/services/ProductService';

const prisma = new PrismaClient();

async function testProductsApi() {
  console.log('🧪 Testando API de listagem de produtos...');

  try {
    const productService = new ProductService(prisma);
    const products = await productService.list(false);
    
    console.log(`📦 Total de produtos: ${products.length}`);
    
    // Filtrar produtos com "Cartão" no nome
    const cartoes = products.filter(p => p.name.toLowerCase().includes('cartão'));
    console.log(`🎴 Cartões de visita encontrados: ${cartoes.length}`);
    
    cartoes.forEach((produto, index) => {
      console.log(`\n=== CARTÃO ${index + 1} ===`);
      console.log(`📦 Nome: ${produto.name}`);
      console.log(`🆔 ID: ${produto.id}`);
      console.log(`💰 Preço: R$ ${produto.salePrice || 'N/A'}`);
      console.log(`🔧 Componentes: ${produto.components?.length || 0}`);
      
      if (produto.components && produto.components.length > 0) {
        console.log('📋 Materiais:');
        produto.components.forEach((comp, i) => {
          console.log(`  ${i + 1}. ${comp.material.name} (${comp.material.format})`);
        });
      } else {
        console.log('⚠️ Nenhum material configurado');
      }
    });

    // Verificar alguns outros produtos com componentes
    const produtosComComponentes = products.filter(p => p.components && p.components.length > 0);
    console.log(`\n✅ Produtos com materiais: ${produtosComComponentes.length}`);
    
    console.log('\n📋 Primeiros 5 produtos com materiais:');
    produtosComComponentes.slice(0, 5).forEach((produto, index) => {
      console.log(`  ${index + 1}. ${produto.name} (${produto.components?.length} materiais)`);
    });

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testProductsApi();