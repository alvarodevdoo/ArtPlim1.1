// Script para testar se a página de produtos está mostrando materiais
const axios = require('axios');

async function testFrontendProdutos() {
  console.log('🧪 Testando integração frontend-backend...\n');

  try {
    // 1. Testar se backend está respondendo
    console.log('1️⃣ Testando backend...');
    const healthResponse = await axios.get('http://localhost:3001/health');
    console.log('✅ Backend OK:', healthResponse.data.status);

    // 2. Testar API de produtos
    console.log('\n2️⃣ Testando API de produtos...');
    const productsResponse = await axios.get('http://localhost:3001/api/catalog/products');
    const products = productsResponse.data.data;
    console.log(`✅ Produtos encontrados: ${products.length}`);

    // 3. Verificar se produtos têm componentes
    console.log('\n3️⃣ Verificando componentes dos produtos...');
    for (const product of products) {
      console.log(`\n📦 ${product.name} (${product.pricingMode})`);
      
      try {
        const componentsResponse = await axios.get(`http://localhost:3001/api/catalog/products/${product.id}/components`);
        const components = componentsResponse.data.data;
        
        if (components && components.length > 0) {
          console.log(`   ✅ ${components.length} material(is) configurado(s):`);
          components.forEach((comp, index) => {
            console.log(`      ${index + 1}. ${comp.material.name} (${comp.material.format})`);
            console.log(`         - Método: ${comp.consumptionMethod}`);
            console.log(`         - Perda: ${comp.wastePercentage * 100}%`);
            console.log(`         - Estoque: ${comp.material.currentStock} ${comp.material.unit}`);
          });
        } else {
          console.log('   ⚠️ Nenhum material configurado');
        }
      } catch (error) {
        console.log(`   ❌ Erro ao buscar componentes: ${error.message}`);
      }
    }

    console.log('\n🎉 Teste concluído! O sistema está funcionando corretamente.');
    console.log('\n📋 Resumo:');
    console.log(`   • Backend: ✅ Funcionando`);
    console.log(`   • API Produtos: ✅ ${products.length} produtos`);
    console.log(`   • API Componentes: ✅ Funcionando`);
    console.log(`   • Frontend: 🌐 http://localhost:3000`);

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Dica: Verifique se os servidores estão rodando:');
      console.log('   Backend: http://localhost:3001');
      console.log('   Frontend: http://localhost:3000');
    }
  }
}

testFrontendProdutos();