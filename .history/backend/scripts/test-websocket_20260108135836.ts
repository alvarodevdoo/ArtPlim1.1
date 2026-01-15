import { PrismaClient } from '@prisma/client';
import { createServer } from 'http';
import { WebSocketServer } from '../src/shared/infrastructure/websocket/WebSocketServer';
import { io as Client } from 'socket.io-client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

async function testWebSocket() {
  console.log('🧪 Iniciando teste do WebSocket...');

  // Criar servidor HTTP temporário
  const httpServer = createServer();
  const websocketServer = new WebSocketServer(httpServer, prisma);

  // Iniciar servidor na porta 3002 para teste
  const PORT = 3002;
  httpServer.listen(PORT, async () => {
    console.log(`🔌 Servidor de teste rodando na porta ${PORT}`);

    try {
      // Buscar um usuário para teste
      const testUser = await prisma.user.findFirst({
        where: { active: true },
        include: { organization: true }
      });

      if (!testUser) {
        console.log('❌ Nenhum usuário encontrado para teste');
        process.exit(1);
      }

      console.log(`👤 Usando usuário de teste: ${testUser.name} (${testUser.email})`);

      // Gerar token JWT para o usuário
      const token = jwt.sign(
        { userId: testUser.id },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      // Conectar cliente WebSocket
      const client = Client(`http://localhost:${PORT}`, {
        auth: { token },
        transports: ['websocket']
      });

      client.on('connect', () => {
        console.log('✅ Cliente conectado com sucesso');
        
        // Testar notificação para organização
        setTimeout(() => {
          console.log('📢 Enviando notificação de teste...');
          websocketServer.notifyOrganization(
            testUser.organizationId,
            'test-notification',
            {
              message: 'Esta é uma notificação de teste',
              timestamp: new Date().toISOString(),
              type: 'TEST'
            }
          );
        }, 1000);
      });

      client.on('test-notification', (data) => {
        console.log('📨 Notificação recebida:', data);
        console.log('✅ Teste do WebSocket concluído com sucesso!');
        
        // Fechar conexões
        client.disconnect();
        httpServer.close();
        process.exit(0);
      });

      client.on('connect_error', (error) => {
        console.error('❌ Erro de conexão:', error);
        httpServer.close();
        process.exit(1);
      });

      client.on('disconnect', (reason) => {
        console.log('🔌 Cliente desconectado:', reason);
      });

      // Timeout de segurança
      setTimeout(() => {
        console.log('⏰ Timeout do teste');
        client.disconnect();
        httpServer.close();
        process.exit(1);
      }, 10000);

    } catch (error) {
      console.error('❌ Erro durante o teste:', error);
      httpServer.close();
      process.exit(1);
    }
  });
}

// Executar teste
testWebSocket().catch(console.error);