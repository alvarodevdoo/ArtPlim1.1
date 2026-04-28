import { prisma } from '../../../shared/infrastructure/database/prisma';
import { AppError } from '../../../shared/infrastructure/errors/AppError';

export interface CreateAuthRequestData {
  organizationId: string;
  requesterId: string;
  type: string;
  data: any;
}

export class AuthorizationService {
  async createRequest({ organizationId, requesterId, type, data }: CreateAuthRequestData) {
    try {
      console.log('[AuthorizationService] Creating request:', { organizationId, requesterId, type });
      const request = await prisma.authorizationRequest.create({
        data: {
          organizationId,
          requesterId,
          type,
          data,
          status: 'PENDING'
        }
      });

      console.log('[AuthorizationService] Request created:', request.id);

      // Criar notificação para os supervisores
      const supervisors = await prisma.user.findMany({
        where: {
          organizationId,
          OR: [
            { role: 'OWNER' },
            { role: 'ADMIN' },
            { role: 'MANAGER' },
            { customRole: { permissions: { some: { permissionKey: 'sales.edit_price' } } } }
          ],
          active: true
        }
      });

      console.log('[AuthorizationService] Found supervisors:', supervisors.length);

      for (const supervisor of supervisors) {
        try {
          await prisma.notifications.create({
            data: {
              organizationId,
              userId: supervisor.id,
              type: 'DISCOUNT_AUTH_REQUEST',
              title: 'Solicitação de Desconto',
              message: `O usuário solicitou autorização para um desconto excedente.`,
              data: { requestId: request.id }
            }
          });
        } catch (notifError: any) {
          console.error('[AuthorizationService] Error creating notification:', notifError.message);
          // Não falha a requisição principal se a notificação falhar
        }
      }

      return request;
    } catch (error: any) {
      console.error('[AuthorizationService] Error in createRequest:', error);
      throw error;
    }
  }

  async getRequestStatus(requestId: string) {
    return prisma.authorizationRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        status: true,
        notes: true,
        reviewedAt: true,
        authorizerId: true
      }
    });
  }

  async listPendingRequests(organizationId: string) {
    return prisma.authorizationRequest.findMany({
      where: {
        organizationId,
        status: 'PENDING'
      },
      include: {
        requester: {
          select: { name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async reviewRequest(requestId: string, authorizerId: string, status: 'APPROVED' | 'REJECTED', notes?: string) {
    const request = await prisma.authorizationRequest.findUnique({
      where: { id: requestId }
    });

    if (!request) throw new AppError('Solicitação não encontrada', 404);

    const updatedRequest = await prisma.authorizationRequest.update({
      where: { id: requestId },
      data: {
        status,
        authorizerId,
        reviewedAt: new Date(),
        notes
      }
    });

    // Notificar o solicitante
    await prisma.notifications.create({
      data: {
        organizationId: request.organizationId,
        userId: request.requesterId,
        type: status === 'APPROVED' ? 'CHANGE_APPROVED' : 'CHANGE_REJECTED',
        title: status === 'APPROVED' ? 'Desconto Aprovado' : 'Desconto Rejeitado',
        message: status === 'APPROVED' ? 'Sua solicitação de desconto foi aprovada.' : `Sua solicitação de desconto foi rejeitada: ${notes || ''}`,
        data: { requestId: request.id }
      }
    });

    // Sincronizar com os Pedidos e Itens vinculados
    if (status === 'APPROVED' || status === 'REJECTED') {
      const discountStatus = status as any; // APPROVED ou REJECTED

      // Atualizar Pedidos vinculados
      await prisma.order.updateMany({
        where: { authorizationRequestId: requestId },
        data: { discountStatus }
      });

      // Atualizar Itens vinculados
      await prisma.orderItem.updateMany({
        where: { authorizationRequestId: requestId },
        data: { discountStatus }
      });
    }

    return updatedRequest;
  }
}
