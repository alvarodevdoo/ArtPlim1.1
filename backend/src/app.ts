import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import { authMiddleware } from './shared/infrastructure/auth/middleware';
import { AppError } from './shared/infrastructure/errors/AppError';

// Routes
import { authRoutes } from './modules/auth/auth.routes';
import { SalesModule } from './modules/sales/SalesModule'; // Nova Arquitetura
import { ProfileService } from './modules/profiles/services/ProfileService';
import { ProductService } from './modules/catalog/services/ProductService';
import { OrganizationService } from './modules/organization/services/OrganizationService';
import { prisma } from './shared/infrastructure/database/prisma';

import { catalogRoutes } from './modules/catalog/catalog.routes';
import { profilesRoutes } from './modules/profiles/profiles.routes';
import { organizationRoutes } from './modules/organization/organization.routes';
import { customConfigRoutes } from './modules/organization/custom-config.routes';
import { wmsRoutes } from './modules/wms/wms.routes';
import { productionRoutes } from './modules/production/production.routes';
import { financeRoutes } from './modules/finance/finance.routes';
import { chartOfAccountsRoutes } from './modules/chartOfAccounts/infrastructure/http/routes';

import { adminRoutes } from './modules/admin/admin.routes';
import { analyticsRoutes } from './modules/analytics/analytics.routes';
import { paymentMethodRoutes } from './modules/finance/payment-method.routes';
import { insumosRoutes } from './modules/insumos/insumos.routes';
import { budgetRoutes } from './modules/sales/budget.routes';
import { fichaTecnicaRoutes } from './modules/catalog/ficha-tecnica.routes';
import { backupRoutes } from './modules/backup/infrastructure/http/routes';
import { roleRoutes } from './modules/roles/infrastructure/http/role.routes';
import { nfeRoutes } from './modules/nfe/nfe.routes';
import biRoutes from './modules/bi/bi.routes';
import productionOrderRoutes from './modules/production/production-order.routes';

async function registerPlugins(fastify: FastifyInstance) {
  const allowedOrigins = [
    'http://localhost:3000',
    'https://erp.artplim.com.br',
    'http://erp.artplim.com.br',
    'https://api.artplim.com.br',
    'http://api.artplim.com.br'
  ];

  await fastify.register(cors, {
    origin: (origin, cb) => {
      // Permitir requests sem origin (como mobile apps ou curl) se em dev
      if (!origin) {
        cb(null, true);
        return;
      }
      
      if (allowedOrigins.includes(origin) || allowedOrigins.some(o => origin.startsWith(o))) {
        cb(null, true);
        return;
      }
      cb(new Error("Not allowed by CORS"), false);
    },
    credentials: true
  });

  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key'
  });

  // Upload Limits para importação de Backups de grande volume
  await fastify.register(multipart, {
    limits: {
      fileSize: 100 * 1024 * 1024 // 100MB
    }
  });

  fastify.decorate('authenticate', authMiddleware);
}

async function registerRoutes(fastify: FastifyInstance, options: { websocketServer?: any } = {}) {
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };
  });

  await fastify.register(async function (api) {
    await api.register(authRoutes, { prefix: '/auth' });
    
    // Configurar e Registrar Módulo de Vendas (Novo)
    const salesModule = new SalesModule(
      prisma,
      new ProfileService(prisma),
      new ProductService(prisma),
      new OrganizationService(prisma)
    );
    await api.register((instance) => salesModule.registerRoutes(instance), { prefix: '/sales' });

    await api.register(catalogRoutes, { prefix: '/catalog' });
    await api.register(profilesRoutes, { prefix: '/profiles' });
    await api.register(organizationRoutes, { prefix: '/organization' });
    await api.register(customConfigRoutes, { prefix: '/organization/config' });
    await api.register(wmsRoutes, { prefix: '/wms' });
    
    if (options.websocketServer) {
        await api.register(productionRoutes, { 
            prefix: '/production',
            websocketServer: options.websocketServer
        });
    }

    await api.register(productionOrderRoutes, { prefix: '/production' });

    await api.register(financeRoutes, { prefix: '/finance' });
    await api.register(chartOfAccountsRoutes, { prefix: '/finance' });

    await api.register(adminRoutes, { prefix: '/admin' });
    await api.register(analyticsRoutes, { prefix: '/analytics' });
    await api.register(biRoutes, { prefix: '/bi' });
    await api.register(paymentMethodRoutes, { prefix: '/payment-methods' });
    await api.register(insumosRoutes, { prefix: '/insumos' });
    await api.register(budgetRoutes, { prefix: '/sales/budgets' });
    await api.register(fichaTecnicaRoutes, { prefix: '/catalog/ficha-tecnica' });
    await api.register(roleRoutes, { prefix: '/roles' });
    await api.register(backupRoutes, { prefix: '/backup' });
    await api.register(nfeRoutes, { prefix: '/nfe' });
  }, { prefix: '/api' });
}

function setupErrorHandler(fastify: FastifyInstance) {
  fastify.setErrorHandler((error: any, request, reply) => {
    fastify.log.error(error);

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: { message: error.message, statusCode: error.statusCode }
      });
    }

    if (error.validation) {
      // Se for um array de erros do Zod/Fastify
      const errorMsg = Array.isArray(error.validation)
        ? `Dados inválidos: ${error.validation.map((v: any) => `${validingPath(v)} ${v.message}`).join(', ')}`
        : 'Dados inválidos';

      function validingPath(v: any) {
        if (!v.instancePath) return '';
        return v.instancePath.replace(/^\//, '') + ':';
      }

      return reply.status(400).send({
        success: false,
        error: { message: errorMsg, statusCode: 400, details: error.validation }
      });
    }

    // Se for erro do Zod importado diretamente e der throw, mas Fastify com Zod normalmente cai no error.validation se tiver configurado certo.
    if (error.name === 'ZodError') {
       const zodError = error as any;
       const msg = zodError.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
       return reply.status(400).send({
        success: false,
        error: { message: `Validação: ${msg}`, statusCode: 400 }
      });
    }

    if (error.code === 'FST_JWT_BAD_REQUEST' || error.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') {
      return reply.status(401).send({
        success: false,
        error: { message: 'Token inválido ou não fornecido', statusCode: 401 }
      });
    }

    return reply.status(500).send({
      success: false,
      error: {
        message: process.env.NODE_ENV === 'production' ? 'Erro interno do servidor' : error.message,
        statusCode: 500
      }
    });
  });
}

export async function buildApp(options: { websocketServer?: any } = {}) {
  const fastify = Fastify({
    logger: process.env.NODE_ENV === 'production' ? false : {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname,reqId' }
      }
    }
  });

  await registerPlugins(fastify);
  await registerRoutes(fastify, options);
  setupErrorHandler(fastify);

  return fastify;
}