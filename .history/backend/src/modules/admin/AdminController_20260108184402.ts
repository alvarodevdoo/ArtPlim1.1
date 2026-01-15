import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../shared/infrastructure/database/prisma';
import { AppError } from '../../shared/infrastructure/errors/AppError';
import { PerformanceMonitor } from '../../shared/infrastructure/http/middleware/performanceMiddleware';
import { CacheService } from '../../shared/infrastructure/cache/CacheService';
import { QueryOptimizer } from '../../shared/infrastructure/database/QueryOptimizer';
import bcrypt from 'bcryptjs';

interface AuthenticatedRequest extends FastifyRequest {
  user: {
    id: string;
    organizationId: string;
    role: string;
  };
}

export class AdminController {
  private cacheService: CacheService;
  private queryOptimizer: QueryOptimizer;

  constructor() {
    this.cacheService = new CacheService();
    this.queryOptimizer = new QueryOptimizer(prisma);
  }
  async listUsers(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { organizationId, role: currentUserRole } = request.user;

      const users = await prisma.user.findMany({
        where: {
          organizationId
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          active: true,
          createdAt: true,
          organizationId: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return reply.send({
        success: true,
        data: users
      });
    } catch (error) {
      console.error('Erro ao listar usuários:', error);
      throw new AppError('Erro ao listar usuários', 500);
    }
  }

  async inviteUser(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { organizationId, role: currentUserRole } = request.user;
      const { name, email, role } = request.body as {
        name: string;
        email: string;
        role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'USER';
      };

      // Verificar se o usuário atual pode convidar para este role
      if (!this.canInviteRole(currentUserRole, role)) {
        throw new AppError('Você não tem permissão para convidar usuários com este perfil', 403);
      }

      // Verificar se o email já existe na organização
      const existingUser = await prisma.user.findFirst({
        where: {
          organizationId,
          email
        }
      });

      if (existingUser) {
        throw new AppError('Já existe um usuário com este email na organização', 400);
      }

      // Gerar senha temporária
      const tempPassword = this.generateTempPassword();
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      // Criar usuário
      const newUser = await prisma.user.create({
        data: {
          organizationId,
          name,
          email,
          password: hashedPassword,
          role,
          active: true
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          active: true,
          createdAt: true,
          organizationId: true
        }
      });

      // TODO: Enviar email com senha temporária
      // Por enquanto, retornar a senha temporária na resposta (apenas para desenvolvimento)
      console.log(`Senha temporária para ${email}: ${tempPassword}`);

      return reply.send({
        success: true,
        data: newUser,
        message: 'Usuário convidado com sucesso! A senha temporária foi enviada por email.'
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Erro ao convidar usuário:', error);
      throw new AppError('Erro ao convidar usuário', 500);
    }
  }

  async updateUser(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { organizationId, role: currentUserRole } = request.user;
      const { userId } = request.params as { userId: string };
      const { name, email, role, active } = request.body as {
        name: string;
        email: string;
        role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'USER';
        active: boolean;
      };

      // Buscar usuário a ser editado
      const targetUser = await prisma.user.findFirst({
        where: {
          id: userId,
          organizationId
        }
      });

      if (!targetUser) {
        throw new AppError('Usuário não encontrado', 404);
      }

      // Verificar se pode gerenciar este usuário
      if (!this.canManageUser(currentUserRole, targetUser.role)) {
        throw new AppError('Você não tem permissão para editar este usuário', 403);
      }

      // Verificar se pode alterar para o novo role
      if (role !== targetUser.role && !this.canInviteRole(currentUserRole, role)) {
        throw new AppError('Você não tem permissão para alterar para este perfil', 403);
      }

      // Verificar se o email já existe (exceto para o próprio usuário)
      if (email !== targetUser.email) {
        const existingUser = await prisma.user.findFirst({
          where: {
            organizationId,
            email,
            id: { not: userId }
          }
        });

        if (existingUser) {
          throw new AppError('Já existe um usuário com este email na organização', 400);
        }
      }

      // Atualizar usuário
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          name,
          email,
          role,
          active
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          active: true,
          createdAt: true,
          organizationId: true
        }
      });

      return reply.send({
        success: true,
        data: updatedUser,
        message: 'Usuário atualizado com sucesso!'
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Erro ao atualizar usuário:', error);
      throw new AppError('Erro ao atualizar usuário', 500);
    }
  }

  async updateUserStatus(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { organizationId, role: currentUserRole } = request.user;
      const { userId } = request.params as { userId: string };
      const { active } = request.body as { active: boolean };

      // Buscar usuário a ser editado
      const targetUser = await prisma.user.findFirst({
        where: {
          id: userId,
          organizationId
        }
      });

      if (!targetUser) {
        throw new AppError('Usuário não encontrado', 404);
      }

      // Verificar se pode gerenciar este usuário
      if (!this.canManageUser(currentUserRole, targetUser.role)) {
        throw new AppError('Você não tem permissão para alterar o status deste usuário', 403);
      }

      // Atualizar status
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { active },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          active: true,
          createdAt: true,
          organizationId: true
        }
      });

      return reply.send({
        success: true,
        data: updatedUser,
        message: `Usuário ${active ? 'ativado' : 'desativado'} com sucesso!`
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Erro ao alterar status do usuário:', error);
      throw new AppError('Erro ao alterar status do usuário', 500);
    }
  }

  async deleteUser(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { organizationId, role: currentUserRole } = request.user;
      const { userId } = request.params as { userId: string };

      // Buscar usuário a ser excluído
      const targetUser = await prisma.user.findFirst({
        where: {
          id: userId,
          organizationId
        }
      });

      if (!targetUser) {
        throw new AppError('Usuário não encontrado', 404);
      }

      // Não permitir excluir OWNER
      if (targetUser.role === 'OWNER') {
        throw new AppError('Não é possível excluir o proprietário da organização', 400);
      }

      // Verificar se pode gerenciar este usuário
      if (!this.canManageUser(currentUserRole, targetUser.role)) {
        throw new AppError('Você não tem permissão para excluir este usuário', 403);
      }

      // Excluir usuário
      await prisma.user.delete({
        where: { id: userId }
      });

      return reply.send({
        success: true,
        message: 'Usuário excluído com sucesso!'
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Erro ao excluir usuário:', error);
      throw new AppError('Erro ao excluir usuário', 500);
    }
  }

  private canManageUser(currentRole: string, targetRole: string): boolean {
    // OWNER pode gerenciar todos
    if (currentRole === 'OWNER') return true;
    
    // ADMIN pode gerenciar MANAGER e USER
    if (currentRole === 'ADMIN') {
      return ['MANAGER', 'USER'].includes(targetRole);
    }
    
    // MANAGER pode gerenciar apenas USER
    if (currentRole === 'MANAGER') {
      return targetRole === 'USER';
    }
    
    return false;
  }

  private canInviteRole(currentRole: string, targetRole: string): boolean {
    // OWNER pode convidar todos os roles
    if (currentRole === 'OWNER') return true;
    
    // ADMIN pode convidar MANAGER e USER
    if (currentRole === 'ADMIN') {
      return ['MANAGER', 'USER'].includes(targetRole);
    }
    
    // MANAGER pode convidar apenas USER
    if (currentRole === 'MANAGER') {
      return targetRole === 'USER';
    }
    
    return false;
  }

  private generateTempPassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  // Novos métodos para performance e monitoramento
  async getPerformanceMetrics(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const performanceMonitor = PerformanceMonitor.getInstance();
      const summary = await performanceMonitor.getPerformanceSummary();
      
      return reply.send({
        success: true,
        data: summary
      });
    } catch (error) {
      console.error('Error getting performance metrics:', error);
      throw new AppError('Erro ao obter métricas de performance', 500);
    }
  }

  async getCacheStats(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const stats = this.cacheService.getStats();
      
      return reply.send({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error getting cache stats:', error);
      throw new AppError('Erro ao obter estatísticas do cache', 500);
    }
  }

  async clearCache(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      await this.cacheService.clear();
      
      return reply.send({
        success: true,
        message: 'Cache limpo com sucesso'
      });
    } catch (error) {
      console.error('Error clearing cache:', error);
      throw new AppError('Erro ao limpar cache', 500);
    }
  }

  async getSystemHealth(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { organizationId } = request.user;
      
      // Verificar saúde do banco de dados
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const dbTime = Date.now() - dbStart;
      
      // Verificar cache
      const cacheStats = this.cacheService.getStats();
      
      // Verificar performance das queries
      const queryStart = Date.now();
      await this.queryOptimizer.getOptimizedProducts(organizationId, 1);
      const queryTime = Date.now() - queryStart;
      
      const health = {
        database: {
          status: dbTime < 100 ? 'healthy' : dbTime < 500 ? 'warning' : 'critical',
          responseTime: dbTime
        },
        cache: {
          status: cacheStats.redisConnected ? 'healthy' : 'warning',
          backend: cacheStats.backend,
          memoryKeys: cacheStats.memoryKeys
        },
        queries: {
          status: queryTime < 50 ? 'healthy' : queryTime < 200 ? 'warning' : 'critical',
          responseTime: queryTime
        },
        overall: 'healthy'
      };
      
      // Determinar status geral
      const statuses = [health.database.status, health.cache.status, health.queries.status];
      if (statuses.includes('critical')) {
        health.overall = 'critical';
      } else if (statuses.includes('warning')) {
        health.overall = 'warning';
      }
      
      return reply.send({
        success: true,
        data: health
      });
    } catch (error) {
      console.error('Error getting system health:', error);
      return reply.status(500).send({
        success: false,
        data: {
          overall: 'critical',
          error: 'Erro ao verificar saúde do sistema'
        }
      });
    }
  }
}