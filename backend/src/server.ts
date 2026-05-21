import { prisma } from './shared/infrastructure/database/prisma';
import { WebSocketServer } from './shared/infrastructure/websocket/WebSocketServer';
import { buildApp } from './app';
import { CardBillReminderService } from './modules/finance/services/CardBillReminderService';

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

        // ── Card Bill Reminder ─────────────────────────────────────────
        // Verifica diariamente cartões com vencimento próximo (janelas 3/1/0 dias)
        // e cria notificação CARD_BILL_DUE. Idempotente por janela/dia.
        const cardReminder = new CardBillReminderService(prisma);
        const runCardCheck = async () => {
            try {
                const r = await cardReminder.runCheck();
                if (r.created > 0) {
                    console.log(`💳 [CardBillReminder] ${r.created} notificação(ões) criada(s) (${r.scanned} cartão(ões) varrido(s))`);
                }
            } catch (e: any) {
                console.error('💳 [CardBillReminder] Erro:', e?.message || e);
            }
        };
        // Roda 30s após subir (pra logar caso já existam cartões a notificar)
        setTimeout(runCardCheck, 30_000);
        // Depois a cada 6 horas
        setInterval(runCardCheck, 6 * 60 * 60 * 1000);

    } catch (err) {
        console.error('Error starting server:', err);
        process.exit(1);
    }
}

start();