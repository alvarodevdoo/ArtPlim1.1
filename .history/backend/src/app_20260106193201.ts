import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { authMiddleware } from './shared/infrastructure/auth/middleware';
import { AppError } from './shared/infrastructure/errors/AppError';

// Routes
import { authRoutes } from './modules/auth/auth.routes';
import { salesRoutes } from './modules/sales/sales.routes';
import { catalogRoutes } from './modules/catalog/catalog.routes';
import { profilesRoutes } from './modules/profiles/profiles.routes';
import { organizationRoutes } from './modules/organization/organization.routes';
import { wmsRoutes } from './modules/wms/wms.routes';
import { productionRoutes } from './modules/production/production.routes';
import { financeRoutes } from './modules/finance/finance.routes';
import { adminRoutes } from './modules/admin/admin.routes';

const fastify = Fastify({
  logger: process.env.NODE_ENV === 'production' ? false : {
    level: 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname,reqId'
      }
    }
  }
});

// Registrar plugins
async function registerPlugins() {
  // CORS
  await fastify.register(cors, {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  });

  // JWT
  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key'
  });

  // Decorator para autenticação
  fastify.decorate('authenticate', authMiddleware);
}

// Registrar rotas
async function registerRoutes() {
  // Rota de health check
  fastify.get('/health', async () => {
    return { 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };
  });

  // Rotas de autenticação (sem prefixo /api)
  await fastify.register(authRoutes, { prefix: '/auth' });

  // Rotas da API (com prefixo /api)
  await fastify.register(async function (fastify) {
    await fastify.register(salesRoutes, { prefix: '/sales' });
    await fastify.register(catalogRoutes, { prefix: '/catalog' });
    await fastify.register(profilesRoutes, { prefix: '/profiles' });
    await fastify.register(organizationRoutes, { prefix: '/organization' });
    await fastify.register(wmsRoutes, { prefix: '/wms' });
    await fastify.register(productionRoutes, { prefix: '/production' });
    await fastify.register(financeRoutes, { prefix: '/finance' });
  }, { prefix: '/api' });
}

// Error handler global
function setupErrorHandler() {
  fastify.setErrorHandler((error, request, reply) => {
    // Log do erro
    fastify.log.error(error);

    // Se é um erro conhecido da aplicação
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: {
          message: error.message,
          statusCode: error.statusCode
        }
      });
    }

    // Erro de validação do Zod
    if (error.validation) {
      return reply.status(400).send({
        success: false,
        error: {
          message: 'Dados inválidos',
          statusCode: 400,
          details: error.validation
        }
      });
    }

    // Erro de JWT
    if (error.code === 'FST_JWT_BAD_REQUEST' || error.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') {
      return reply.status(401).send({
        success: false,
        error: {
          message: 'Token inválido ou não fornecido',
          statusCode: 401
        }
      });
    }

    // Erro interno do servidor
    return reply.status(500).send({
      success: false,
      error: {
        message: process.env.NODE_ENV === 'production' 
          ? 'Erro interno do servidor' 
          : error.message,
        statusCode: 500
      }
    });
  });
}

// Inicializar aplicação
export async function buildApp() {
  await registerPlugins();
  await registerRoutes();
  setupErrorHandler();
  
  return fastify;
}

export default fastify;