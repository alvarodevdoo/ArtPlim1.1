import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    organizationId: string;
    email: string;
    name: string;
    role: string;
  };
}

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Token de acesso não fornecido',
          statusCode: 401
        }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Token de acesso inválido',
          statusCode: 401
        }
      });
    }

    // Verificar e decodificar o token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    if (!decoded.userId) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Token inválido',
          statusCode: 401
        }
      });
    }

    // Buscar dados atualizados do usuário
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        organizationId: true,
        organization: {
          select: {
            id: true,
            name: true,
            active: true
          }
        }
      }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Usuário não encontrado',
          statusCode: 401
        }
      });
    }

    if (!user.active) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Usuário inativo',
          statusCode: 401
        }
      });
    }

    if (!user.organization?.active) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Organização inativa',
          statusCode: 401
        }
      });
    }

    // Adicionar dados do usuário à requisição
    req.user = {
      userId: user.id,
      organizationId: user.organizationId,
      email: user.email,
      name: user.name,
      role: user.role
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Token inválido',
          statusCode: 401
        }
      });
    }
    
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Token expirado',
          statusCode: 401
        }
      });
    }
    
    return res.status(500).json({
      success: false,
      error: {
        message: 'Erro interno do servidor',
        statusCode: 500
      }
    });
  }
};

export default authMiddleware;