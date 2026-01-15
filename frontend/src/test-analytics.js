// Script de teste para verificar se o frontend consegue acessar as APIs de analytics

const API_BASE_URL = 'http://localhost:3001/api';

// Simular um token JWT (você deve usar um token real)
const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

async function testAnalyticsEndpoints() {
  console.log('🧪 Testando endpoints de Analytics...');

  const endpoints = [
    '/analytics/dashboard',
    '/analytics/kpis',
    '/analytics/sales-chart',
    '/analytics/cost-analysis',
    '/analytics/material-analysis'
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`\n📡 Testando ${endpoint}...`);
      
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${TEST_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ ${endpoint}: ${response.status} - ${data.success ? 'Sucesso' : 'Erro'}`);
        
        if (data.data) {
          console.log(`📊 Dados recebidos: ${JSON.stringify(data.data).substring(0, 100)}...`);
        }
      } else {
        console.log(`❌ ${endpoint}: ${response.status} - ${response.statusText}`);
        const errorText = await response.text();
        console.log(`   Erro: ${errorText.substring(0, 200)}...`);
      }
    } catch (error) {
      console.log(`❌ ${endpoint}: Erro de conexão - ${error.message}`);
    }
  }

  console.log('\n🎉 Teste de endpoints concluído!');
}

// Executar teste
testAnalyticsEndpoints().catch(console.error);