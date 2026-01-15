import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { PrismaClient } from '@prisma/client';
import { WebSocketServer } from './shared/infrastructure/websocket/WebSocketServer';
import createProductionRoutes from './modules/production/production.routes';
import { authMiddleware } from './shared/infrastructure/http/middleware/authMiddleware';

// Importar outras rotas (convertidas para Express)
import { createAuthRoutes } from './modules/auth/auth.routes.express';
import { createSalesRoutes } from './modules/sales/sales.routes.express';
import { createCatalogRoutes } from './modules/catalog/catalog.routes.express';
import { createAnalyticsRoutes } from './modules/analytics/analytics.routes.express';

const app = express();
const httpServer = createServer(app);
const prisma = new PrismaClient();

// Configurar CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Middleware para parsing JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Inicializar WebSocket Server
const websocketServer = new WebSocketServer(httpServer, prisma);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.1.0',
    websocket: {
      connections: websocketServer.getStats().totalConnections
    }
  });
});

// Rotas de autenticação (sem middleware de auth)
app.use('/auth', createAuthRoutes(prisma));

// Middleware de autenticação para rotas protegidas
app.use('/api', authMiddleware);

// Rotas da API
app.use('/api/sales', createSalesRoutes(prisma));
app.use('/api/catalog', createCatalogRoutes(prisma));
app.use('/api/production', createProductionRoutes(prisma, websocketServer));
app.use('/api/analytics', createAnalyticsRoutes(prisma));

// Rota para testar WebSocket
app.get('/api/websocket/test', authMiddleware, (req: any, res) => {
  const { organizationId } = req.user;
  
  // Enviar notificação de teste
  websocketServer.notifyOrganization(organizationId, 'test-notification', {
    message: 'Teste de conectividade WebSocket',
    timestamp: new Date().toISOString()
  });
  
  res.json({ 
    success: true, 
    message: 'Notificação de teste enviada',
    stats: websocketServer.getStats()
  });
});

// Error handler global
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global error handler:', error);
  
  // Erro de validação
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: {
        message: error.message,
        statusCode: 400
      }
    });
  }
  
  // Erro de JWT
  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: {
        message: 'Token inválido ou expirado',
        statusCode: 401
      }
    });
  }
  
  // Erro interno
  res.status(500).json({
    success: false,
    error: {
      message: process.env.NODE_ENV === 'production' 
        ? 'Erro interno do servidor' 
        : error.message,
      statusCode: 500
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'Rota não encontrada',
      statusCode: 404
    }
  });
});

const PORT = process.env.PORT || 3001;

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  
  websocketServer.close();
  await prisma.$disconnect();
  
  httpServer.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  
  websocketServer.close();
  await prisma.$disconnect();
  
  httpServer.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

// Iniciar servidor
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔌 WebSocket server ready`);
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

export { app, httpServer, websocketServer, prisma };