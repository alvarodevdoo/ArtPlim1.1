// Simple test script to verify the product-material integration
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3002';

async function testIntegration() {
  console.log('🧪 Testing Product-Material Integration...\n');

  try {
    // 1. Test getting products
    console.log('1. Testing products endpoint...');
    const productsResponse = await fetch(`${BASE_URL}/api/catalog/products`);
    const productsData = await productsResponse.json();
    
    if (productsData.success && productsData.data.length > 0) {
      console.log(`✅ Found ${productsData.data.length} products`);
      const testProduct = productsData.data[0];
      console.log(`   Using product: ${testProduct.name} (ID: ${testProduct.id})`);
      
      // 2. Test getting product components
      console.log('\n2. Testing product components endpoint...');
      const componentsResponse = await fetch(`${BASE_URL}/api/catalog/products/${testProduct.id}/components`);
      const componentsData = await componentsResponse.json();
      
      if (componentsData.success) {
        console.log(`✅ Product has ${componentsData.data.length} material components configured`);
        
        if (componentsData.data.length > 0) {
          componentsData.data.forEach((component, index) => {
            console.log(`   Component ${index + 1}: ${component.material.name} (${component.consumptionMethod})`);
          });
        } else {
          console.log('   ℹ️  No components configured - MaterialCalculator will use fallback mock data');
        }
      } else {
        console.log('❌ Failed to get product components');
      }
      
      // 3. Test materials endpoint
      console.log('\n3. Testing materials endpoint...');
      const materialsResponse = await fetch(`${BASE_URL}/api/catalog/materials`);
      const materialsData = await materialsResponse.json();
      
      if (materialsData.success) {
        console.log(`✅ Found ${materialsData.data.length} materials in catalog`);
      } else {
        console.log('❌ Failed to get materials');
      }
      
    } else {
      console.log('❌ No products found');
    }
    
    console.log('\n🎉 Integration test completed!');
    console.log('\n📋 Next steps:');
    console.log('   1. Open http://localhost:3000 in your browser');
    console.log('   2. Navigate to "Criar Pedido" (Create Order)');
    console.log('   3. Select a product and enter dimensions');
    console.log('   4. See the MaterialCalculator show real material requirements');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testIntegration();