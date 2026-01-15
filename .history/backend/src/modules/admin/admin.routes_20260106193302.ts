import { FastifyInstance } from 'fastify';
import { AdminController } from './AdminController';

const inviteUserSchema = {
  type: 'object',
  required: ['name', 'email', 'role'],
  properties: {
    name: { type: 'string', minLength: 2 },
    email: { type: 'string', format: 'email' },
    role: { type: 'string', enum: ['OWNER', 'ADMIN', 'MANAGER', 'USER'] }
  }
};

const updateUserSchema = {
  type: 'object',
  required: ['name', 'email', 'role', 'active'],
  properties: {
    name: { type: 'string', minLength: 2 },
    email: { type: 'string', format: 'email' },
    role: { type: 'string', enum: ['OWNER', 'ADMIN', 'MANAGER', 'USER'] },
    active: { type: 'boolean' }
  }
};

const updateUserStatusSchema = {
  type: 'object',
  required: ['active'],
  properties: {
    active: { type: 'boolean' }
  }
};

export async function adminRoutes(fastify: FastifyInstance) {
  const adminController = new AdminController();

  // Middleware de autenticação para todas as rotas admin
  fastify.addHook('preHandler', async (request, reply) => {
    await request.jwtVerify();
  });

  // Middleware de autorização para admin
  fastify.addHook('preHandler', async (request, reply) => {
    const user = request.user as any;
    
    if (!['OWNER', 'ADMIN', 'MANAGER'].includes(user.role)) {
      return reply.status(403).send({
        success: false,
        error: {
          message: 'Acesso negado. Apenas administradores podem acessar esta funcionalidade.',
          statusCode: 403
        }
      });
    }
  });

  // Listar usuários
  fastify.get('/users', async (request, reply) => {
    return adminController.listUsers(request, reply);
  });

  // Convidar usuário
  fastify.post('/users/invite', {
    schema: {
      body: inviteUserSchema
    }
  }, async (request, reply) => {
    return adminController.inviteUser(request, reply);
  });

  // Atualizar usuário
  fastify.put('/users/:userId', {
    schema: {
      body: updateUserSchema,
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid' }
        },
        required: ['userId']
      }
    }
  }, async (request, reply) => {
    return adminController.updateUser(request, reply);
  });

  // Alterar status do usuário
  fastify.patch('/users/:userId/status', {
    schema: {
      body: updateUserStatusSchema,
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid' }
        },
        required: ['userId']
      }
    }
  }, async (request, reply) => {
    return adminController.updateUserStatus(request, reply);
  });

  // Excluir usuário
  fastify.delete('/users/:userId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid' }
        },
        required: ['userId']
      }
    }
  }, async (request, reply) => {
    return adminController.deleteUser(request, reply);
  });
}