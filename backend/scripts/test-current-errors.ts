import axios from 'axios';

const API_BASE = 'http://localhost:3001';

async function testCurrentErrors() {
  console.log('🧪 Testando erros atuais do frontend');
  console.log('=====================================\n');

  try {
    // 1. Tentar fazer login
    console.log('1️⃣ Fazendo login...');
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'admin@teste.com',
      password: 'admin123',
      organizationSlug: 'teste'
    });

    if (!loginResponse.data.success) {
      console.error('❌ Falha no login');
      return;
    }

    const authToken = loginResponse.data.data.token;
    console.log('✅ Login realizado com sucesso!');

    const headers = {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    // 2. Testar /api/organization/settings
    console.log('\n2️⃣ Testando /api/organization/settings...');
    try {
      const orgSettingsResponse = await axios.get(`${API_BASE}/api/organization/settings`, { headers });
      console.log('✅ Organization settings OK:', orgSettingsResponse.data);
    } catch (error: any) {
      console.error('❌ Erro em /api/organization/settings:');
      console.error('Status:', error.response?.status);
      console.error('Data:', error.response?.data);
    }

    // 3. Testar /api/profiles?isCustomer=true
    console.log('\n3️⃣ Testando /api/profiles?isCustomer=true...');
    try {
      const profilesResponse = await axios.get(`${API_BASE}/api/profiles?isCustomer=true`, { headers });
      console.log('✅ Profiles OK:', profilesResponse.data);
    } catch (error: any) {
      console.error('❌ Erro em /api/profiles?isCustomer=true:');
      console.error('Status:', error.response?.status);
      console.error('Data:', error.response?.data);
    }

    // 4. Testar outros endpoints básicos
    console.log('\n4️⃣ Testando outros endpoints...');
    
    const endpoints = [
      '/api/organization',
      '/api/profiles',
      '/api/sales/orders',
      '/api/catalog/products'
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await axios.get(`${API_BASE}${endpoint}`, { headers });
        console.log(`✅ ${endpoint}: OK`);
      } catch (error: any) {
        console.error(`❌ ${endpoint}: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
      }
    }

  } catch (error: any) {
    console.error('❌ Erro durante os testes:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testCurrentErrors().catch(console.error);