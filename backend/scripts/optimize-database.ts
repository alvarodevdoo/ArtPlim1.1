import { PrismaClient } from '@prisma/client';
import { QueryOptimizer } from '../src/shared/infrastructure/database/QueryOptimizer';

const prisma = new PrismaClient();

async function optimizeDatabase() {
  console.log('🔧 Iniciando otimização do banco de dados...');

  try {
    const optimizer = new QueryOptimizer(prisma);

    // 1. Criar índices otimizados
    console.log('\n📊 Criando índices otimizados...');
    await optimizer.createOptimizedIndexes();

    // 2. Analisar performance atual
    console.log('\n📈 Analisando performance das queries...');
    await optimizer.analyzeQueryPerformance();

    // 3. Obter estatísticas das tabelas
    console.log('\n📋 Obtendo estatísticas das tabelas...');
    await optimizer.getDatabaseStats();

    // 4. Atualizar estatísticas do PostgreSQL
    console.log('\n🔄 Atualizando estatísticas do PostgreSQL...');
    await prisma.$executeRaw`ANALYZE`;

    // 5. Vacuum das tabelas principais
    console.log('\n🧹 Executando VACUUM nas tabelas principais...');
    const tables = ['orders', 'order_items', 'products', 'materials', 'product_components', 'profiles'];
    
    for (const table of tables) {
      try {
        await prisma.$executeRawUnsafe(`VACUUM ANALYZE ${table}`);
        console.log(`✅ VACUUM executado na tabela: ${table}`);
      } catch (error) {
        console.log(`⚠️ Erro no VACUUM da tabela ${table}:`, error);
      }
    }

    // 6. Verificar e otimizar views materializadas
    console.log('\n🔍 Verificando views materializadas...');
    try {
      const views = await prisma.$queryRaw`
        SELECT schemaname, matviewname, ispopulated 
        FROM pg_matviews 
        WHERE schemaname = 'public'
      `;
      
      console.log('📊 Views materializadas encontradas:');
      console.table(views);

      // Refresh das views se necessário
      console.log('\n🔄 Atualizando views materializadas...');
      await prisma.$executeRaw`SELECT refresh_analytics_views()`;
      console.log('✅ Views materializadas atualizadas');

    } catch (error) {
      console.log('⚠️ Erro ao verificar views materializadas:', error);
    }

    // 7. Verificar configurações de performance
    console.log('\n⚙️ Verificando configurações de performance...');
    try {
      const configs = await prisma.$queryRaw`
        SELECT name, setting, unit, short_desc 
        FROM pg_settings 
        WHERE name IN (
          'shared_buffers',
          'effective_cache_size',
          'maintenance_work_mem',
          'checkpoint_completion_target',
          'wal_buffers',
          'default_statistics_target',
          'random_page_cost',
          'effective_io_concurrency'
        )
        ORDER BY name
      `;
      
      console.log('📊 Configurações de performance:');
      console.table(configs);
    } catch (error) {
      console.log('⚠️ Erro ao verificar configurações:', error);
    }

    // 8. Verificar tamanho das tabelas
    console.log('\n📏 Verificando tamanho das tabelas...');
    try {
      const tableSizes = await prisma.$queryRaw`
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
          pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        LIMIT 10
      `;
      
      console.log('📊 Top 10 maiores tabelas:');
      console.table(tableSizes);
    } catch (error) {
      console.log('⚠️ Erro ao verificar tamanho das tabelas:', error);
    }

    // 9. Verificar conexões ativas
    console.log('\n🔗 Verificando conexões ativas...');
    try {
      const connections = await prisma.$queryRaw`
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `;
      
      console.log('📊 Estatísticas de conexões:');
      console.table(connections);
    } catch (error) {
      console.log('⚠️ Erro ao verificar conexões:', error);
    }

    // 10. Recomendações de otimização
    console.log('\n💡 Recomendações de otimização:');
    console.log('1. Configure shared_buffers para 25% da RAM disponível');
    console.log('2. Configure effective_cache_size para 75% da RAM disponível');
    console.log('3. Configure maintenance_work_mem para 256MB ou mais');
    console.log('4. Configure checkpoint_completion_target para 0.9');
    console.log('5. Configure random_page_cost para 1.1 (SSDs) ou 4.0 (HDDs)');
    console.log('6. Configure effective_io_concurrency para 200 (SSDs) ou 2 (HDDs)');
    console.log('7. Configure max_connections baseado no uso real');
    console.log('8. Configure work_mem baseado no número de conexões');

    console.log('\n🎉 Otimização do banco de dados concluída!');
    console.log('\n📋 Próximos passos:');
    console.log('1. Monitore a performance das queries após as otimizações');
    console.log('2. Execute este script periodicamente (semanal/mensal)');
    console.log('3. Considere implementar particionamento para tabelas grandes');
    console.log('4. Configure backup automático das views materializadas');

  } catch (error) {
    console.error('❌ Erro durante a otimização:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Função para testar performance de queries específicas
async function testQueryPerformance() {
  console.log('🧪 Testando performance de queries específicas...');

  const optimizer = new QueryOptimizer(prisma);
  const startTime = Date.now();

  try {
    // Teste 1: Query de produtos otimizada
    console.log('\n📊 Testando query de produtos...');
    const productsStart = Date.now();
    const products = await optimizer.getOptimizedProducts('test-org-id', 50);
    const productsTime = Date.now() - productsStart;
    console.log(`✅ Produtos carregados: ${products.length} em ${productsTime}ms`);

    // Teste 2: Query de pedidos otimizada
    console.log('\n📊 Testando query de pedidos...');
    const ordersStart = Date.now();
    const orders = await optimizer.getOptimizedOrders('test-org-id', 20);
    const ordersTime = Date.now() - ordersStart;
    console.log(`✅ Pedidos carregados: ${orders.length} em ${ordersTime}ms`);

    // Teste 3: Query de dashboard
    console.log('\n📊 Testando query de dashboard...');
    const dashboardStart = Date.now();
    const dashboardStats = await optimizer.getDashboardStats(
      'test-org-id',
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      new Date()
    );
    const dashboardTime = Date.now() - dashboardStart;
    console.log(`✅ Dashboard stats carregadas em ${dashboardTime}ms`);

    const totalTime = Date.now() - startTime;
    console.log(`\n🎉 Todos os testes concluídos em ${totalTime}ms`);

    // Análise de performance
    console.log('\n📈 Análise de Performance:');
    if (productsTime < 100) console.log('✅ Query de produtos: EXCELENTE');
    else if (productsTime < 300) console.log('⚠️ Query de produtos: BOA');
    else console.log('❌ Query de produtos: PRECISA OTIMIZAÇÃO');

    if (ordersTime < 100) console.log('✅ Query de pedidos: EXCELENTE');
    else if (ordersTime < 300) console.log('⚠️ Query de pedidos: BOA');
    else console.log('❌ Query de pedidos: PRECISA OTIMIZAÇÃO');

    if (dashboardTime < 200) console.log('✅ Query de dashboard: EXCELENTE');
    else if (dashboardTime < 500) console.log('⚠️ Query de dashboard: BOA');
    else console.log('❌ Query de dashboard: PRECISA OTIMIZAÇÃO');

  } catch (error) {
    console.error('❌ Erro nos testes de performance:', error);
  }
}

// Executar otimização
const args = process.argv.slice(2);
if (args.includes('--test-only')) {
  testQueryPerformance().catch(console.error);
} else {
  optimizeDatabase().catch(console.error);
}