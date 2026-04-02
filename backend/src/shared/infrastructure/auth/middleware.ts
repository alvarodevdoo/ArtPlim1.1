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
    user: JWTPayload & { permissions: string[] };
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
    
    // Verificação de segurança: O registro ainda existe e quais são suas permissões customizadas?
    const { prisma } = await import('../database/prisma');
    const userExists = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { 
        id: true, 
        active: true,
        role: true,
        roleId: true,
        customRole: {
          select: {
            permissions: { select: { permissionKey: true } }
          }
        }
      }
    });

    if (!userExists || !userExists.active) {
      throw new UnauthorizedError('Sessão expirada ou usuário desativado');
    }

    let permissions: string[] = [];
    if (userExists.customRole) {
      permissions = userExists.customRole.permissions.map((p) => p.permissionKey);
    } else {
      // Fallback para Administradores e Proprietários sem Role vinculada
      if (userExists.role === 'OWNER') {
        permissions = ['admin.organization', 'admin.settings', 'admin.users', 'finance.view', 'sales.view', 'production.view', 'inventory.view'];
      } else if (userExists.role === 'ADMIN') {
        permissions = ['admin.settings', 'admin.users', 'finance.view', 'sales.view', 'production.view', 'inventory.view', 'finance.reports'];
      }
    }

    request.user = { 
      ...decoded, 
      role: userExists.role,
      permissions
    };
    
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    throw new UnauthorizedError('Token inválido ou sessão expirada');
  }
}

// Novo Guard de Controle de Acesso Baseado em Permissão
export function requirePermission(permissionKeys: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      throw new UnauthorizedError('Usuário não autenticado');
    }

    // O Proprietário (OWNER) é o super usuário nato e sempre terá acesso absoluto, independente da matriz.
    if (request.user.role === 'OWNER') {
      return;
    }

    // Se não for OWNER, ele precisa ter pelo menos UMA das chaves exigidas pela rota.
    const hasPermission = permissionKeys.some(key => request.user.permissions.includes(key));
    
    if (!hasPermission) {
      throw new UnauthorizedError('Permissão insuficiente para acessar este recurso');
    }
  };
}