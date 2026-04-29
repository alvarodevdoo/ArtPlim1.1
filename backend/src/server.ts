import { prisma } from './shared/infrastructure/database/prisma';
import { WebSocketServer } from './shared/infrastructure/websocket/WebSocketServer';
import { buildApp } from './app';

const PORT = process.env.PORT || 3001;
// A instância do prisma é importada acima

async function start() {
    try {
        // 1. Criar a instância básica do Fastify sem rotas que dependem de infra ainda não pronta (opcional)
        // No nosso caso, o buildApp já registra tudo. 
        // Vamos criar a infra primeiro.
        
        // Para o WebSocketServer, precisamos do httpServer. 
        // No Fastify, o httpServer é criado assim que a instância é gerada.
        
        const fastify = await buildApp(); 
        console.log('🚀 Iniciando servidor Fastify...');

        // Graceful shutdown
        const shutdown = async () => {
            console.log('🛑 Shutting down gracefully...');
            (fastify as any).websocketServer?.close();
            await prisma.$disconnect();
            await fastify.close();
            process.exit(0);
        };

        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);

        await fastify.listen({ port: Number(PORT), host: '0.0.0.0' });
        
        console.log(`🚀 Fastify Server running on port ${PORT}`);
        console.log(`🔌 WebSocket server ready`);
        console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);

    } catch (err) {
        console.error('Error starting server:', err);
        process.exit(1);
    }
}

start();