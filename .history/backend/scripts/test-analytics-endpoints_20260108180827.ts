import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_BASE_URL = 'http://localhost:3001/api';

// Buscar um usuário real do banco para criar o token
const getTestUser = async () => {
  const user = await prisma.user.findFirst({
    where: { 
      email: 'admin@analytics.com',
      active: true
    },
    include: {
      organization: true
    }
  });
  
  if (!user) {
    throw new Error('Usuário de teste não encontrado. Execute o seed primeiro.');
  }
  
  return user;
};

// Criar um token JWT válido para teste
const createTestToken = (userId: string) => {
  const payload = {
    userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hora
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET || 'your-super-secret-jwt-key');
};

async function testAnalyticsEndpoints() {
  console.log('🧪 Testando endpoints de Analytics...');

  try {
    // Buscar usuário real
    const user = await getTestUser();
    console.log(`✅ Usuário encontrado: ${user.name} (${user.email})`);
    console.log(`✅ Organização: ${user.organization.name}`);

    const token = createTestToken(user.id);
    console.log('🔑 Token JWT criado para teste');

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
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`✅ ${endpoint}: ${response.status} - ${data.success ? 'Sucesso' : 'Erro'}`);
          
          if (data.data) {
            const dataStr = JSON.stringify(data.data);
            console.log(`📊 Dados recebidos: ${dataStr.substring(0, 100)}...`);
          }
        } else {
          console.log(`❌ ${endpoint}: ${response.status} - ${response.statusText}`);
          const errorText = await response.text();
          console.log(`   Erro: ${errorText.substring(0, 200)}...`);
        }
      } catch (error: any) {
        console.log(`❌ ${endpoint}: Erro de conexão - ${error.message}`);
      }
    }

    // Testar refresh de views
    try {
      console.log(`\n🔄 Testando refresh de views...`);
      
      const response = await fetch(`${API_BASE_URL}/analytics/refresh-views`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Refresh views: ${response.status} - ${data.success ? 'Sucesso' : 'Erro'}`);
        console.log(`   Mensagem: ${data.message}`);
      } else {
        console.log(`❌ Refresh views: ${response.status} - ${response.statusText}`);
      }
    } catch (error: any) {
      console.log(`❌ Refresh views: Erro de conexão - ${error.message}`);
    }

    console.log('\n🎉 Teste de endpoints concluído!');
    console.log('\n📋 Próximos passos:');
    console.log('1. Testar no frontend com token real');
    console.log('2. Verificar se os dados estão sendo retornados corretamente');
    console.log('3. Implementar cache Redis se necessário');

  } catch (error: any) {
    console.error('❌ Erro ao executar teste:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar teste
testAnalyticsEndpoints().catch(console.error);