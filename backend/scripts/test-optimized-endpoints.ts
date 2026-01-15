import axios from 'axios';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:3001';

// Buscar um usuário real do banco para criar o token
const getTestUser = async () => {
  const user = await prisma.user.findFirst({
    where: { 
      active: true
    },
    include: {
      organization: true
    }
  });
  
  if (!user) {
    throw new Error('Usuário de teste não encontrado.');
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

async function testOptimizedEndpoints() {
  console.log('🧪 Testando Endpoints Otimizados');
  console.log('=====================================\n');

  try {
    // Buscar usuário real
    const user = await getTestUser();
    console.log(`✅ Usuário encontrado: ${user.name} (${user.email})`);
    console.log(`✅ Organização: ${user.organization.name}`);

    const authToken = createTestToken(user.id);
    console.log('🔑 Token JWT criado para teste\n');

    const headers = {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    console.log('2️⃣ Testando endpoints otimizados...\n');

    // Endpoints para testar
    const endpoints = [
      // Sales (Otimizados)
      { method: 'GET', url: '/api/sales/orders', name: 'Pedidos Otimizados' },
      { method: 'GET', url: '/api/sales/orders/stats', name: 'Estatísticas de Pedidos' },
      
      // Catalog (Otimizados)
      { method: 'GET', url: '/api/catalog/products', name: 'Produtos Otimizados' },
      { method: 'GET', url: '/api/catalog/materials', name: 'Materiais Otimizados' },
      
      // Profiles (Otimizados)
      { method: 'GET', url: '/api/profiles?isCustomer=true', name: 'Clientes Otimizados' },
      { method: 'GET', url: '/api/profiles/customers/list', name: 'Lista de Clientes' },
      { method: 'GET', url: '/api/profiles?isEmployee=true', name: 'Funcionários Otimizados' },
      { method: 'GET', url: '/api/profiles/employees/list', name: 'Lista de Funcionários' },
      
      // Organization
      { method: 'GET', url: '/api/organization', name: 'Dados da Organização' },
      { method: 'GET', url: '/api/organization/settings', name: 'Configurações' },
      { method: 'GET', url: '/api/organization/users', name: 'Usuários da Organização' },
      
      // Finance
      { method: 'GET', url: '/api/finance/accounts', name: 'Contas Financeiras' },
      { method: 'GET', url: '/api/finance/transactions', name: 'Transações' },
      { method: 'GET', url: '/api/finance/categories', name: 'Categorias Financeiras' },
      { method: 'GET', url: '/api/finance/dashboard', name: 'Dashboard Financeiro' },
      
      // WMS
      { method: 'GET', url: '/api/wms/inventory', name: 'Inventário' },
      { method: 'GET', url: '/api/wms/movements', name: 'Movimentações de Estoque' },
      { method: 'GET', url: '/api/wms/alerts', name: 'Alertas de Estoque' },
      
      // Analytics
      { method: 'GET', url: '/api/analytics/dashboard', name: 'Dashboard Analytics' },
      { method: 'GET', url: '/api/analytics/sales-metrics', name: 'Métricas de Vendas' },
      
      // Production
      { method: 'GET', url: '/api/production/pending-changes', name: 'Mudanças Pendentes' },
    ];

    let successCount = 0;
    let errorCount = 0;

    for (const endpoint of endpoints) {
      try {
        const response = await axios({
          method: endpoint.method,
          url: `${API_BASE}${endpoint.url}`,
          headers
        });

        if (response.status === 200 && response.data.success) {
          console.log(`✅ ${endpoint.name}: OK (${response.data.data ? Object.keys(response.data.data).length : 0} items)`);
          successCount++;
        } else {
          console.log(`⚠️ ${endpoint.name}: Resposta inesperada`);
          errorCount++;
        }
      } catch (error: any) {
        if (error.response) {
          console.log(`❌ ${endpoint.name}: ${error.response.status} - ${error.response.statusText}`);
          if (error.response.status === 404) {
            console.log(`   🔍 Endpoint não encontrado: ${endpoint.url}`);
          }
        } else {
          console.log(`❌ ${endpoint.name}: Erro de conexão`);
        }
        errorCount++;
      }
    }

    console.log('\n📊 Resumo dos Testes:');
    console.log('====================');
    console.log(`✅ Sucessos: ${successCount}`);
    console.log(`❌ Erros: ${errorCount}`);
    console.log(`📈 Taxa de Sucesso: ${((successCount / endpoints.length) * 100).toFixed(1)}%`);

    if (errorCount === 0) {
      console.log('\n🎉 Todos os endpoints estão funcionando corretamente!');
      console.log('🚀 Sistema otimizado e pronto para uso!');
    } else {
      console.log('\n⚠️ Alguns endpoints precisam de atenção.');
      console.log('🔧 Verifique os logs acima para detalhes.');
    }

  } catch (error: any) {
    console.error('❌ Erro durante os testes:', error.message);
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Executar testes
testOptimizedEndpoints().catch(console.error);