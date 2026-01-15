import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testAnalyticsAPI() {
  console.log('🧪 Testando APIs de Analytics...');

  try {
    // Buscar organização de teste
    const organization = await prisma.organization.findFirst({
      where: { slug: 'grafica-analytics' }
    });

    if (!organization) {
      console.log('❌ Organização de teste não encontrada. Execute o seed primeiro.');
      return;
    }

    console.log(`✅ Organização encontrada: ${organization.name}`);

    // Buscar usuário admin
    const admin = await prisma.user.findFirst({
      where: { 
        organizationId: organization.id,
        email: 'admin@analytics.com'
      }
    });

    if (!admin) {
      console.log('❌ Usuário admin não encontrado.');
      return;
    }

    console.log(`✅ Usuário admin encontrado: ${admin.name}`);

    // Testar queries das views materializadas
    console.log('\n📊 Testando views materializadas...');

    // Testar SalesMetrics
    const salesMetrics = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM "SalesMetrics" 
      WHERE "organizationId" = ${organization.id}
    `;
    console.log(`✅ SalesMetrics: ${(salesMetrics as any)[0].count} registros`);

    // Testar CostAnalysis
    const costAnalysis = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM "CostAnalysis" 
      WHERE "organizationId" = ${organization.id}
    `;
    console.log(`✅ CostAnalysis: ${(costAnalysis as any)[0].count} registros`);

    // Testar MaterialAnalysis
    const materialAnalysis = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM "MaterialAnalysis" 
      WHERE "organizationId" = ${organization.id}
    `;
    console.log(`✅ MaterialAnalysis: ${(materialAnalysis as any)[0].count} registros`);

    // Testar ProductionMetrics
    const productionMetrics = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM "ProductionMetrics" 
      WHERE "organizationId" = ${organization.id}
    `;
    console.log(`✅ ProductionMetrics: ${(productionMetrics as any)[0].count} registros`);

    // Testar dados de exemplo das views
    console.log('\n📈 Testando dados das views...');

    // Exemplo de dados de vendas
    const salesData = await prisma.$queryRaw`
      SELECT 
        date,
        order_count,
        total_revenue,
        avg_order_value
      FROM "SalesMetrics" 
      WHERE "organizationId" = ${organization.id}
      ORDER BY date DESC
      LIMIT 5
    `;
    console.log('📊 Últimas 5 métricas de vendas:');
    console.table(salesData);

    // Exemplo de análise de custos
    const costData = await prisma.$queryRaw`
      SELECT 
        product_name,
        total_revenue,
        total_margin,
        avg_margin_percentage
      FROM "CostAnalysis" 
      WHERE "organizationId" = ${organization.id}
      ORDER BY total_revenue DESC
      LIMIT 5
    `;
    console.log('💰 Top 5 produtos por receita:');
    console.table(costData);

    // Exemplo de análise de materiais
    const materialData = await prisma.$queryRaw`
      SELECT 
        material_name,
        theoretical_consumption,
        estimated_consumption,
        avg_waste_percentage,
        waste_cost
      FROM "MaterialAnalysis" 
      WHERE "organizationId" = ${organization.id}
      ORDER BY waste_cost DESC
      LIMIT 5
    `;
    console.log('🔧 Top 5 materiais por custo de desperdício:');
    console.table(materialData);

    console.log('\n🎉 Teste das APIs de Analytics concluído com sucesso!');
    console.log('\n📋 Próximos passos:');
    console.log('1. Iniciar o servidor backend: npm run dev');
    console.log('2. Testar endpoints via HTTP:');
    console.log('   - GET /api/analytics/dashboard');
    console.log('   - GET /api/analytics/kpis');
    console.log('   - GET /api/analytics/cost-analysis');
    console.log('   - GET /api/analytics/material-analysis');

  } catch (error) {
    console.error('❌ Erro ao testar APIs de Analytics:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testAnalyticsAPI().catch(console.error);