// Script de debug para testar a API de produtos
// Execute no console do navegador

async function debugProdutos() {
  try {
    console.log('🔍 Testando API de produtos...');
    
    const response = await fetch('/api/catalog/products', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error('❌ Erro na resposta:', response.status, response.statusText);
      return;
    }
    
    const data = await response.json();
    console.log('📦 Dados recebidos:', data);
    
    if (data.data) {
      const produtos = data.data;
      console.log(`📊 Total de produtos: ${produtos.length}`);
      
      // Verificar cartões
      const cartoes = produtos.filter(p => p.name.toLowerCase().includes('cartão'));
      console.log(`🎴 Cartões encontrados: ${cartoes.length}`);
      
      cartoes.forEach((cartao, index) => {
        console.log(`\n=== CARTÃO ${index + 1} ===`);
        console.log(`📦 Nome: ${cartao.name}`);
        console.log(`🆔 ID: ${cartao.id}`);
        console.log(`🔧 Componentes: ${cartao.components?.length || 0}`);
        console.log(`📋 Estrutura components:`, cartao.components);
      });
      
      // Verificar produtos com componentes
      const comComponentes = produtos.filter(p => p.components && p.components.length > 0);
      console.log(`✅ Produtos com componentes: ${comComponentes.length}`);
      
      if (comComponentes.length > 0) {
        console.log('📋 Primeiro produto com componentes:', comComponentes[0]);
      }
    }
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

// Execute a função
debugProdutos();