import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { getTenantClient } from '../../shared/infrastructure/database/prisma';
import { AuthenticatedRequest } from '../../shared/infrastructure/http/middleware/authMiddleware';

// Validations
const createPaymentMethodSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  type: z.enum(['PIX', 'CARD', 'CASH', 'TRANSFER', 'BOLETO', 'OTHER']),
  feePercentage: z.number().min(0).default(0),
  installmentRules: z.object({
    maxInstallments: z.number().min(1).optional(),
    interestFreeInstallments: z.number().min(1).optional(),
  }).optional(),
  active: z.boolean().default(true),
});

const updatePaymentMethodSchema = createPaymentMethodSchema.partial();

export function createPaymentMethodRoutes(prisma: PrismaClient) {
  const router = Router();

  // List all payment methods
  router.get('/', async (req: Request, res: Response) => {
    try {
      const request = req as AuthenticatedRequest;
      const client = getTenantClient(request.user!.organizationId);

      const methods = await client.paymentMethod.findMany({
        where: { organizationId: request.user!.organizationId },
        orderBy: { name: 'asc' }
      });

      res.json({
        success: true,
        data: methods
      });
    } catch (error: any) {
      console.error('Erro ao listar métodos de pagamento:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao listar métodos de pagamento',
        error: error.message
      });
    }
  });

  // Get single payment method
  router.get('/:id', async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      const request = req as AuthenticatedRequest;
      const client = getTenantClient(request.user!.organizationId);

      const method = await client.paymentMethod.findFirst({
        where: {
          id,
          organizationId: request.user!.organizationId
        }
      });

      if (!method) {
        return res.status(404).json({
          success: false,
          message: 'Método de pagamento não encontrado'
        });
      }

      res.json({
        success: true,
        data: method
      });
    } catch (error: any) {
      console.error('Erro ao buscar método de pagamento:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao buscar método de pagamento'
      });
    }
  });

  // Create payment method
  router.post('/', async (req: Request, res: Response) => {
    try {
      const request = req as AuthenticatedRequest;
      const data = createPaymentMethodSchema.parse(req.body);
      const client = getTenantClient(request.user!.organizationId);

      const method = await client.paymentMethod.create({
        data: {
          ...data,
          organizationId: request.user!.organizationId,
        }
      });

      res.status(201).json({
        success: true,
        message: 'Método de pagamento criado com sucesso',
        data: method
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Dados inválidos',
          errors: error.errors
        });
      }
      res.status(500).json({
        success: false,
        message: 'Erro ao criar método de pagamento',
        error: error.message
      });
    }
  });

  // Update payment method
  router.put('/:id', async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      const request = req as AuthenticatedRequest;
      const data = updatePaymentMethodSchema.parse(req.body);
      const client = getTenantClient(request.user!.organizationId);

      // Verify ownership
      const existing = await client.paymentMethod.findFirst({
        where: {
          id,
          organizationId: request.user!.organizationId
        }
      });

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Método de pagamento não encontrado'
        });
      }

      const method = await client.paymentMethod.update({
        where: { id },
        data
      });

      res.json({
        success: true,
        message: 'Método de pagamento atualizado',
        data: method
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Erro ao atualizar método de pagamento',
        error: error.message
      });
    }
  });

  // Toggle status (Active/Inactive)
  router.patch('/:id/toggle-status', async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      const request = req as AuthenticatedRequest;
      const client = getTenantClient(request.user!.organizationId);

      const existing = await client.paymentMethod.findFirst({
        where: {
          id,
          organizationId: request.user!.organizationId
        }
      });

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Método de pagamento não encontrado'
        });
      }

      const method = await client.paymentMethod.update({
        where: { id },
        data: { active: !existing.active }
      });

      res.json({
        success: true,
        message: `Método de pagamento ${method.active ? 'ativado' : 'desativado'} com sucesso`,
        data: method
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Erro ao alterar status',
        error: error.message
      });
    }
  });

  // Delete payment method
  router.delete('/:id', async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      const request = req as AuthenticatedRequest;
      const client = getTenantClient(request.user!.organizationId);

      // Check if used in transactions
      const usageCount = await client.transaction.count({
        where: {
          paymentMethodId: id,
          organizationId: request.user!.organizationId
        }
      });

      if (usageCount > 0) {
        return res.status(400).json({
          success: false,
          message: 'Este método de pagamento não pode ser excluído pois possui transações vinculadas. Tente desativá-lo.'
        });
      }

      await client.paymentMethod.delete({
        where: {
          id,
          organizationId: request.user!.organizationId
        }
      });

      res.json({
        success: true,
        message: 'Método de pagamento removido com sucesso'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Erro ao excluir método de pagamento',
        error: error.message
      });
    }
  });

  return router;
}
