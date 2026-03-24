import { FastifyRequest, FastifyReply } from 'fastify';
import { UnauthorizedError } from '../errors/AppError';

interface JWTPayload {
  userId: string;
  organizationId: string;
  role: string;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JWTPayload;
    user: JWTPayload;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  try {
    const token = request.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      throw new UnauthorizedError('Token não fornecido');
    }

    const decoded = request.server.jwt.verify(token) as JWTPayload;
    
    // Verificação de segurança: O registro ainda existe no banco após um possível reset?
    const { prisma } = await import('../database/prisma');
    const userExists = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, active: true }
    });

    if (!userExists || !userExists.active) {
      throw new UnauthorizedError('Sessão expirada ou usuário desativado');
    }

    request.user = decoded;
    
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    throw new UnauthorizedError('Token inválido ou sessão expirada');
  }
}

export function requireRole(roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      throw new UnauthorizedError('Usuário não autenticado');
    }

    if (!roles.includes(request.user.role)) {
      throw new UnauthorizedError('Permissão insuficiente');
    }
  };
}