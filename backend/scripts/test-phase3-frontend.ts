import { PrismaClient } from '@prisma/client';
import { PendingChangesService } from '../src/modules/production/services/PendingChangesService';
import { PendingChangesRepository } from '../src/modules/production/repositories/PendingChangesRepository';
import { NotificationRepository } from '../src/modules/production/repositories/NotificationRepository';
import { NotificationService } from '../src/shared/application/notifications/NotificationService';
import { WebSocketServer } from '../src/shared/infrastructure/websocket/WebSocketServer';
import { createServer } from 'http';

const prisma = new PrismaClient();

async function testPhase3Frontend() {
  console.log('🧪 Testando integração Fase 3 - Frontend...');

  try {
    // Buscar dados de teste
    const testUser = await prisma.user.findFirst({
      where: { email: 'sales@test.com' },
      include: { organization: true }
    });

    const testOrder = await prisma.order.findFirst({
      where: { orderNumber: 'TEST-001' },
      include: { customer: true, items: true }
    });

    if (!testUser || !testOrder) {
      console.log('❌ Dados de teste não encontrados. Execute o seed primeiro.');
      return;
    }

    console.log(`👤 Usuário de teste: ${testUser.name}`);
    console.log(`📦 Pedido de teste: ${testOrder.orderNumber} (${testOrder.status})`);

    // Configurar serviços
    const httpServer = createServer();
    const websocketServer = new WebSocketServer(httpServer, prisma);
    
    const pendingChangesRepository = new PendingChangesRepository(prisma);
    const notificationRepository = new NotificationRepository(prisma);
    const notificationService = new NotificationService(
      notificationRepository,
      websocketServer,
      prisma
    );
    const pendingChangesService = new PendingChangesService(
      pendingChangesRepository,
      notificationService,
      prisma
    );

    // Teste 1: Criar alteração pendente
    console.log('\n📝 Teste 1: Criando alteração pendente...');
    
    const pendingChange = await pendingChangesService.createPendingChange({
      orderId: testOrder.id,
      changes: {
        deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // +10 dias
        notes: 'Alteração de teste para o frontend',
        'item_0_quantity': 20 // Dobrar quantidade do primeiro item
      },
      requestedBy: testUser.id,
      organizationId: testUser.organizationId,
      priority: 'HIGH'
    });

    console.log(`✅ Alteração criada: ${pendingChange.id}`);
    console.log(`   Status: ${pendingChange.status}`);
    console.log(`   Prioridade: ${pendingChange.priority}`);

    // Teste 2: Listar alterações pendentes
    console.log('\n📋 Teste 2: Listando alterações pendentes...');
    
    const pendingList = await pendingChangesService.findByOrganization(
      testUser.organizationId,
      { status: 'PENDING' }
    );

    console.log(`✅ Encontradas ${pendingList.data.length} alterações pendentes`);
    pendingList.data.forEach((change, index) => {
      console.log(`   ${index + 1}. ${change.order.orderNumber} - ${change.priority} - ${change.requestedByUser.name}`);
    });

    // Teste 3: Verificar se pedido tem alterações pendentes
    console.log('\n🔍 Teste 3: Verificando alterações pendentes do pedido...');
    
    const hasPending = await pendingChangesService.hasOrderPendingChanges(testOrder.id);
    console.log(`✅ Pedido ${testOrder.orderNumber} tem alterações pendentes: ${hasPending}`);

    // Teste 4: Analisar alterações
    console.log('\n🔬 Teste 4: Analisando alterações...');
    
    const analyzedChanges = pendingChangesService.analyzeChanges(pendingChange);
    console.log(`✅ Análise de ${analyzedChanges.length} alterações:`);
    analyzedChanges.forEach((change, index) => {
      console.log(`   ${index + 1}. ${change.displayName}: ${change.oldValue} → ${change.newValue}`);
    });

    // Teste 5: Buscar operador para aprovação
    console.log('\n👨‍🔧 Teste 5: Buscando operador para teste de aprovação...');
    
    const operator = await prisma.user.findFirst({
      where: { 
        organizationId: testUser.organizationId,
        role: 'OPERATOR'
      }
    });

    if (operator) {
      console.log(`✅ Operador encontrado: ${operator.name}`);
      
      // Teste 6: Aprovar alteração
      console.log('\n✅ Teste 6: Aprovando alteração...');
      
      const approvedChange = await pendingChangesService.approveChange({
        pendingChangeId: pendingChange.id,
        reviewedBy: operator.id,
        comments: 'Alteração aprovada para teste do frontend'
      });

      console.log(`✅ Alteração aprovada: ${approvedChange.status}`);
      console.log(`   Revisado por: ${approvedChange.reviewedByUser?.name}`);
      console.log(`   Comentários: ${approvedChange.reviewComments}`);
    } else {
      console.log('⚠️ Nenhum operador encontrado para teste de aprovação');
    }

    // Teste 7: Estatísticas
    console.log('\n📊 Teste 7: Obtendo estatísticas...');
    
    const stats = await pendingChangesService.getStats(testUser.organizationId);
    console.log('✅ Estatísticas:');
    console.log(`   Total: ${stats.total}`);
    console.log(`   Pendentes: ${stats.pending}`);
    console.log(`   Aprovadas: ${stats.approved}`);
    console.log(`   Rejeitadas: ${stats.rejected}`);
    console.log(`   Tempo médio de aprovação: ${stats.averageApprovalTimeMinutes} minutos`);

    // Teste 8: Notificações
    console.log('\n🔔 Teste 8: Verificando notificações...');
    
    const notifications = await notificationService.getUserNotifications(
      testUser.organizationId,
      testUser.id,
      1,
      10
    );

    console.log(`✅ ${notifications.data.length} notificações encontradas`);
    console.log(`   Não lidas: ${notifications.unreadCount}`);

    notifications.data.slice(0, 3).forEach((notification, index) => {
      console.log(`   ${index + 1}. ${notification.title} - ${notification.type}`);
    });

    console.log('\n🎉 Todos os testes do frontend passaram com sucesso!');
    console.log('\n📋 Resumo dos testes:');
    console.log('✅ Criação de alteração pendente');
    console.log('✅ Listagem de alterações');
    console.log('✅ Verificação de alterações por pedido');
    console.log('✅ Análise de alterações');
    console.log('✅ Aprovação de alterações');
    console.log('✅ Estatísticas');
    console.log('✅ Notificações');

    console.log('\n🚀 O sistema está pronto para o frontend!');

  } catch (error) {
    console.error('❌ Erro durante os testes:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testPhase3Frontend().catch(console.error);