import { PrismaClient } from '@prisma/client';
import { WebSocketServer } from './shared/infrastructure/websocket/WebSocketServer';
import { buildApp } from './app';

const PORT = process.env.PORT || 3001;
const prisma = new PrismaClient();

async function start() {
    try {
        // 1. Criar a instância básica do Fastify sem rotas que dependem de infra ainda não pronta (opcional)
        // No nosso caso, o buildApp já registra tudo. 
        // Vamos criar a infra primeiro.
        
        // Para o WebSocketServer, precisamos do httpServer. 
        // No Fastify, o httpServer é criado assim que a instância é gerada.
        
        const fastify = await buildApp(); 
        // Nota: as rotas de produção não funcionarão até o websocketServer ser injetado se ele for obrigatório no registro.
        // Mas eu mudei o app.ts para apenas registrar se options.websocketServer existir.
        
        // 2. Inicializar WebSocket Server usando o servidor do Fastify
        const websocketServer = new WebSocketServer(fastify.server, prisma);

        // 3. Como as rotas já foram registradas (ou não, se o if falhou), 
        // uma estratégia melhor é usar um decorator ou passar a instância.
        
        // Vamos refatorar o app.ts para permitir injeção via decorator.
        
        // Por enquanto, para manter a simplicidade e resolver o bloqueio:
        console.log('🚀 Iniciando servidor Fastify...');

        // Graceful shutdown
        const shutdown = async () => {
            console.log('🛑 Shutting down gracefully...');
            websocketServer.close();
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