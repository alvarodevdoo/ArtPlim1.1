import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AuthService } from './services/AuthService';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  organizationSlug: z.string().min(1, 'Slug da organização é obrigatório')
});

const registerSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  organizationName: z.string().min(2, 'Nome da organização é obrigatório'),
  organizationSlug: z.string().min(2, 'Slug da organização é obrigatório')
});

export async function authRoutes(fastify: FastifyInstance) {
  const authService = new AuthService();

  // Login
  fastify.post('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);
    
    const result = await authService.login(body);
    
    // Gerar token JWT
    const token = fastify.jwt.sign(result.payload);
    
    return reply.code(200).send({
      success: true,
      data: {
        token,
        user: result.user
      }
    });
  });

  // Registro (primeira organização)
  fastify.post('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);
    
    const result = await authService.register(body);
    
    return reply.code(201).send({
      success: true,
      data: result
    });
  });

  const authorizeSupervisorSchema = z.object({
    email: z.string().email('Email inválido'),
    password: z.string().min(1, 'Senha é obrigatória'),
  });

  // Autorização de Supervisor
  fastify.post('/authorize-supervisor', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    try {
      const body = authorizeSupervisorSchema.parse(request.body);
      const result = await authService.authorizeSupervisor(request.user!.organizationId, body.email, body.password);
      
      return reply.code(200).send({
        success: true,
        data: result
      });
    } catch (error: any) {
      return reply.code(401).send({
        success: false,
        message: error.message
      });
    }
  });

  // Verificar token
  fastify.get('/me', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const user = await authService.getProfile(request.user!.userId);
    
    return reply.send({
      success: true,
      data: user
    });
  });
}