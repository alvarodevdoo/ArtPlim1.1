import { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { AuthService } from './services/AuthService';
import { PrismaClient } from '@prisma/client';

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

export function createAuthRoutes(prisma: PrismaClient): Router {
  const router = Router();
  const authService = new AuthService();

  // Login
  router.post('/login', async (req, res) => {
    try {
      const body = loginSchema.parse(req.body);
      
      const result = await authService.login(body);
      
      // Gerar token JWT
      const token = jwt.sign(result.payload, process.env.JWT_SECRET || 'your-super-secret-jwt-key');
      
      res.json({
        success: true,
        data: {
          token,
          user: result.user
        }
      });
    } catch (error: any) {
      console.error('Erro no login:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Erro no login'
      });
    }
  });

  // Registro (primeira organização)
  router.post('/register', async (req, res) => {
    try {
      const body = registerSchema.parse(req.body);
      
      const result = await authService.register(body);
      
      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('Erro no registro:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Erro no registro'
      });
    }
  });

  // Verificar token
  router.get('/me', async (req: any, res) => {
    try {
      // Verificar se há token
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'Token não fornecido'
        });
      }

      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-super-secret-jwt-key') as any;
      
      const user = await authService.getProfile(decoded.userId);
      
      res.json({
        success: true,
        data: user
      });
    } catch (error: any) {
      console.error('Erro ao verificar token:', error);
      res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }
  });

  return router;
}