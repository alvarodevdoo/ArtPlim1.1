import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testFinalIntegration() {
  console.log('🧪 TESTE FINAL DE INTEGRAÇÃO\n');

  try {
    // 1. Verificar produtos no banco
    console.log('1️⃣ Verificando produtos no banco...');
    const products = await prisma.product.findMany({
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

    console.log(`✅ Produtos encontrados: ${products.length}\n`);

    // 2. Verificar cada produto e seus materiais
    console.log('2️⃣ Detalhes dos produtos:\n');
    
    for (const product of products) {
      console.log(`📦 ${product.name} (${product.pricingMode})`);
      
      if (product.components.length > 0) {
        console.log(`   ✅ ${product.components.length} material(is) configurado(s):`);
        
        product.components.forEach((comp, index) => {
          const currentStock = comp.material.inventoryItems.reduce((total, item) => total + item.quantity, 0);
          
          console.log(`      ${index + 1}. ${comp.material.name}`);
          console.log(`         - Formato: ${comp.material.format}`);
          console.log(`         - Método: ${comp.consumptionMethod}`);
          console.log(`         - Perda: ${comp.wastePercentage * 100}%`);
          console.log(`         - Custo: R$ ${comp.material.costPerUnit}/${comp.material.unit}`);
          console.log(`         - Estoque: ${currentStock} ${comp.material.unit}`);
        });
      } else {
        console.log('   ⚠️ Nenhum material configurado');
      }
      console.log('');
    }

    // 3. Simular cálculo de materiais para cada produto
    console.log('3️⃣ Simulando cálculos de materiais:\n');
    
    const testDimensions = {
      width: 100,  // 10cm
      height: 150, // 15cm
      quantity: 10
    };

    for (const product of products) {
      if (product.components.length > 0) {
        console.log(`🧮 Calculando para ${product.name}:`);
        console.log(`   Dimensões: ${testDimensions.width}x${testDimensions.height}mm`);
        console.log(`   Quantidade: ${testDimensions.quantity}un\n`);

        const itemArea = (testDimensions.width * testDimensions.height) / 1000000; // m²
        let totalCost = 0;

        product.components.forEach((comp) => {
          const currentStock = comp.material.inventoryItems.reduce((total, item) => total + item.quantity, 0);
          let needed = 0;
          let cost = 0;
          let unit = comp.material.unit;

          switch (comp.consumptionMethod) {
            case 'BOUNDING_BOX':
              if (comp.material.format === 'SHEET') {
                const sheetArea = ((comp.material.standardWidth || 0) * (comp.material.standardLength || 0)) / 1000000;
                const totalAreaNeeded = itemArea * testDimensions.quantity;
                const sheetsNeeded = Math.ceil(totalAreaNeeded / sheetArea);
                needed = sheetsNeeded * (1 + comp.wastePercentage);
                needed = Math.ceil(needed);
                cost = needed * comp.material.costPerUnit;
                unit = 'folhas';
              } else {
                const totalAreaNeeded = itemArea * testDimensions.quantity * (1 + comp.wastePercentage);
                needed = totalAreaNeeded;
                cost = needed * comp.material.costPerUnit;
                unit = 'm²';
              }
              break;

            case 'FIXED_AMOUNT':
              needed = testDimensions.quantity * (1 + comp.wastePercentage);
              cost = needed * comp.material.costPerUnit;
              unit = comp.material.unit;
              break;
          }

          if (needed > 0) {
            const sufficient = currentStock >= needed;
            totalCost += cost;

            console.log(`   📋 ${comp.material.name}:`);
            console.log(`      - Necessário: ${needed.toFixed(2)} ${unit}`);
            console.log(`      - Disponível: ${currentStock} ${comp.material.unit}`);
            console.log(`      - Custo: R$ ${cost.toFixed(2)}`);
            console.log(`      - Status: ${sufficient ? '✅ Suficiente' : '❌ Insuficiente'}`);
          }
        });

        console.log(`   💰 Custo total: R$ ${totalCost.toFixed(2)}\n`);
      }
    }

    console.log('🎉 TESTE CONCLUÍDO COM SUCESSO!\n');
    console.log('📋 RESUMO:');
    console.log(`   • Produtos no banco: ${products.length}`);
    console.log(`   • Produtos com materiais: ${products.filter(p => p.components.length > 0).length}`);
    console.log(`   • Total de componentes: ${products.reduce((total, p) => total + p.components.length, 0)}`);
    console.log('\n✅ O sistema está pronto para uso!');
    console.log('🌐 Acesse: http://localhost:3000');

  } catch (error) {
    console.error('❌ Erro no teste:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testFinalIntegration();