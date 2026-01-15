import { PrismaClient, PendingChangePriority, OrderStatus } from '@prisma/client';
import { PendingChangesRepository, PendingChangeWithRelations, CreatePendingChangeData } from '../repositories/PendingChangesRepository';
import { NotificationService } from '../../../shared/application/notifications/NotificationService';

export interface ChangeField {
  field: string;
  oldValue: any;
  newValue: any;
  displayName: string;
}

export interface CreatePendingChangeRequest {
  orderId: string;
  changes: Record<string, any>;
  requestedBy: string;
  organizationId: string;
  priority?: PendingChangePriority;
  reason?: string;
}

export interface ApproveChangeRequest {
  pendingChangeId: string;
  reviewedBy: string;
  comments?: string;
}

export interface RejectChangeRequest {
  pendingChangeId: string;
  reviewedBy: string;
  comments: string; // Obrigatório para rejeição
}

export class PendingChangesService {
  constructor(
    private pendingChangesRepository: PendingChangesRepository,
    private notificationService: NotificationService,
    private prisma: PrismaClient
  ) {}

  /**
   * Cria uma nova solicitação de alteração
   */
  async createPendingChange(request: CreatePendingChangeRequest): Promise<PendingChangeWithRelations> {
    try {
      // Validar se o pedido existe e está em produção
      const order = await this.prisma.order.findUnique({
        where: { id: request.orderId },
        include: {
          customer: { select: { name: true } },
          items: true
        }
      });

      if (!order) {
        throw new Error('Pedido não encontrado');
      }

      if (order.status !== 'IN_PRODUCTION') {
        throw new Error('Apenas pedidos em produção podem ter alterações pendentes');
      }

      // Verificar se já existe alteração pendente para este pedido
      const existingPending = await this.pendingChangesRepository.findPendingByOrder(request.orderId);
      if (existingPending.length > 0) {
        throw new Error('Já existe uma alteração pendente para este pedido');
      }

      // Validar usuário solicitante
      const requestingUser = await this.prisma.user.findUnique({
        where: { id: request.requestedBy },
        select: { id: true, name: true, organizationId: true, role: true }
      });

      if (!requestingUser || requestingUser.organizationId !== request.organizationId) {
        throw new Error('Usuário não autorizado');
      }

      // Calcular prioridade automaticamente se não fornecida
      const priority = request.priority || this.calculatePriority(request.changes, order);

      // Criar dados da alteração pendente
      const pendingChangeData: CreatePendingChangeData = {
        orderId: request.orderId,
        organizationId: request.organizationId,
        requestedBy: request.requestedBy,
        changes: request.changes,
        originalData: this.serializeOrderData(order),
        priority
      };

      // Criar alteração pendente
      const pendingChange = await this.pendingChangesRepository.create(pendingChangeData);

      // Enviar notificação
      await this.notificationService.notifyChangeRequest(pendingChange);

      console.log(`✅ Pending change created for order ${order.orderNumber} by ${requestingUser.name}`);

      return pendingChange;
    } catch (error) {
      console.error('Error creating pending change:', error);
      throw error;
    }
  }

  /**
   * Aprova uma alteração pendente
   */
  async approveChange(request: ApproveChangeRequest): Promise<PendingChangeWithRelations> {
    try {
      // Buscar alteração pendente
      const pendingChange = await this.pendingChangesRepository.findById(request.pendingChangeId);
      if (!pendingChange) {
        throw new Error('Alteração pendente não encontrada');
      }

      if (pendingChange.status !== 'PENDING') {
        throw new Error('Esta alteração já foi processada');
      }

      // Validar usuário revisor
      const reviewingUser = await this.prisma.user.findUnique({
        where: { id: request.reviewedBy },
        select: { id: true, name: true, organizationId: true, role: true }
      });

      if (!reviewingUser || reviewingUser.organizationId !== pendingChange.organizationId) {
        throw new Error('Usuário não autorizado');
      }

      if (!['OPERATOR', 'ADMIN', 'OWNER'].includes(reviewingUser.role)) {
        throw new Error('Usuário não tem permissão para aprovar alterações');
      }

      // Aplicar alterações ao pedido
      await this.applyChangesToOrder(pendingChange);

      // Atualizar status da alteração
      const updatedPendingChange = await this.pendingChangesRepository.update(request.pendingChangeId, {
        status: 'APPROVED',
        reviewedBy: request.reviewedBy,
        reviewedAt: new Date(),
        reviewComments: request.comments
      });

      // Registrar no histórico do pedido (implementar futuramente)
      await this.addOrderHistoryEntry(pendingChange.orderId, {
        action: 'CHANGE_APPROVED',
        description: `Alteração aprovada por ${reviewingUser.name}`,
        userId: request.reviewedBy,
        data: { pendingChangeId: request.pendingChangeId, comments: request.comments }
      });

      // Enviar notificação
      await this.notificationService.notifyChangeDecision(
        updatedPendingChange,
        true,
        reviewingUser.name,
        request.comments
      );

      console.log(`✅ Change approved for order ${pendingChange.order.orderNumber} by ${reviewingUser.name}`);

      return updatedPendingChange;
    } catch (error) {
      console.error('Error approving change:', error);
      throw error;
    }
  }

  /**
   * Rejeita uma alteração pendente
   */
  async rejectChange(request: RejectChangeRequest): Promise<PendingChangeWithRelations> {
    try {
      // Buscar alteração pendente
      const pendingChange = await this.pendingChangesRepository.findById(request.pendingChangeId);
      if (!pendingChange) {
        throw new Error('Alteração pendente não encontrada');
      }

      if (pendingChange.status !== 'PENDING') {
        throw new Error('Esta alteração já foi processada');
      }

      // Validar usuário revisor
      const reviewingUser = await this.prisma.user.findUnique({
        where: { id: request.reviewedBy },
        select: { id: true, name: true, organizationId: true, role: true }
      });

      if (!reviewingUser || reviewingUser.organizationId !== pendingChange.organizationId) {
        throw new Error('Usuário não autorizado');
      }

      if (!['OPERATOR', 'ADMIN', 'OWNER'].includes(reviewingUser.role)) {
        throw new Error('Usuário não tem permissão para rejeitar alterações');
      }

      // Atualizar status da alteração
      const updatedPendingChange = await this.pendingChangesRepository.update(request.pendingChangeId, {
        status: 'REJECTED',
        reviewedBy: request.reviewedBy,
        reviewedAt: new Date(),
        reviewComments: request.comments
      });

      // Registrar no histórico do pedido
      await this.addOrderHistoryEntry(pendingChange.orderId, {
        action: 'CHANGE_REJECTED',
        description: `Alteração rejeitada por ${reviewingUser.name}: ${request.comments}`,
        userId: request.reviewedBy,
        data: { pendingChangeId: request.pendingChangeId, comments: request.comments }
      });

      // Enviar notificação
      await this.notificationService.notifyChangeDecision(
        updatedPendingChange,
        false,
        reviewingUser.name,
        request.comments
      );

      console.log(`❌ Change rejected for order ${pendingChange.order.orderNumber} by ${reviewingUser.name}`);

      return updatedPendingChange;
    } catch (error) {
      console.error('Error rejecting change:', error);
      throw error;
    }
  }

  /**
   * Lista alterações pendentes por organização
   */
  async findByOrganization(organizationId: string, filters: any = {}, page: number = 1, limit: number = 50) {
    return this.pendingChangesRepository.findByOrganization(organizationId, filters, page, limit);
  }

  /**
   * Lista alterações de um pedido específico
   */
  async findByOrder(orderId: string): Promise<PendingChangeWithRelations[]> {
    return this.pendingChangesRepository.findByOrder(orderId);
  }

  /**
   * Verifica se um pedido tem alterações pendentes
   */
  async hasOrderPendingChanges(orderId: string): Promise<boolean> {
    return this.pendingChangesRepository.hasOrderPendingChanges(orderId);
  }

  /**
   * Obtém estatísticas de alterações
   */
  async getStats(organizationId: string) {
    const [basicStats, averageApprovalTime] = await Promise.all([
      this.pendingChangesRepository.getStatsByOrganization(organizationId),
      this.pendingChangesRepository.getAverageApprovalTime(organizationId)
    ]);

    return {
      ...basicStats,
      averageApprovalTimeMinutes: averageApprovalTime
    };
  }

  /**
   * Aplica as alterações ao pedido
   */
  private async applyChangesToOrder(pendingChange: PendingChangeWithRelations): Promise<void> {
    const { orderId, changes } = pendingChange;

    // Aplicar alterações usando transação
    await this.prisma.$transaction(async (tx) => {
      // Buscar o pedido atual com seus itens
      const currentOrder = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true }
      });

      if (!currentOrder) {
        throw new Error('Pedido não encontrado');
      }

      // Aplicar alterações no pedido principal
      const orderUpdates: any = {};
      const itemUpdates: any[] = [];

      for (const [field, newValue] of Object.entries(changes)) {
        if (field.startsWith('item_')) {
          // Alteração em item do pedido
          const [, itemIndex, itemField] = field.split('_');
          const itemIndexNum = parseInt(itemIndex);
          
          // Verificar se o índice é válido
          if (itemIndexNum >= 0 && itemIndexNum < currentOrder.items.length) {
            const item = currentOrder.items[itemIndexNum];
            const existingUpdate = itemUpdates.find(u => u.id === item.id);
            
            if (existingUpdate) {
              existingUpdate.data[itemField] = newValue;
            } else {
              itemUpdates.push({
                id: item.id,
                data: { [itemField]: newValue }
              });
            }
          } else {
            console.warn(`Item index ${itemIndexNum} not found in order ${orderId}`);
          }
        } else {
          // Alteração no pedido principal
          orderUpdates[field] = newValue;
        }
      }

      // Atualizar pedido principal se houver alterações
      if (Object.keys(orderUpdates).length > 0) {
        await tx.order.update({
          where: { id: orderId },
          data: orderUpdates
        });
        console.log(`✅ Order ${orderId} updated:`, Object.keys(orderUpdates));
      }

      // Atualizar itens do pedido
      for (const itemUpdate of itemUpdates) {
        await tx.orderItem.update({
          where: { id: itemUpdate.id },
          data: itemUpdate.data
        });
        console.log(`✅ Order item ${itemUpdate.id} updated:`, Object.keys(itemUpdate.data));
      }
    });

    console.log(`✅ Changes applied to order ${orderId}`);
  }

  /**
   * Calcula a prioridade da alteração baseada no tipo de mudança
   */
  private calculatePriority(changes: Record<string, any>, order: any): PendingChangePriority {
    // Alterações críticas (HIGH)
    const criticalFields = ['deliveryDate', 'total', 'status'];
    if (Object.keys(changes).some(field => criticalFields.includes(field))) {
      return 'HIGH';
    }

    // Alterações em itens (MEDIUM)
    if (Object.keys(changes).some(field => field.startsWith('item_'))) {
      return 'MEDIUM';
    }

    // Outras alterações (LOW)
    return 'LOW';
  }

  /**
   * Serializa dados do pedido para armazenamento
   */
  private serializeOrderData(order: any): any {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      subtotal: order.subtotal,
      discount: order.discount,
      tax: order.tax,
      total: order.total,
      deliveryDate: order.deliveryDate,
      notes: order.notes,
      items: order.items?.map((item: any) => ({
        id: item.id,
        productId: item.productId,
        width: item.width,
        height: item.height,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        notes: item.notes
      })) || []
    };
  }

  /**
   * Adiciona entrada no histórico do pedido
   */
  private async addOrderHistoryEntry(orderId: string, entry: {
    action: string;
    description: string;
    userId: string;
    data?: any;
  }): Promise<void> {
    // Por enquanto, apenas log. Futuramente implementar tabela de histórico
    console.log(`📝 Order ${orderId} history: ${entry.action} - ${entry.description}`);
  }

  /**
   * Analisa as diferenças entre o estado original e as alterações
   */
  public analyzeChanges(pendingChange: PendingChangeWithRelations): ChangeField[] {
    const changes: ChangeField[] = [];
    const { originalData, changes: newChanges } = pendingChange;

    for (const [field, newValue] of Object.entries(newChanges)) {
      let oldValue: any;
      let displayName: string;

      if (field.startsWith('item_')) {
        const [, itemId, itemField] = field.split('_');
        const originalItem = originalData.items?.find((item: any) => item.id === itemId);
        oldValue = originalItem?.[itemField];
        displayName = `Item ${itemField}`;
      } else {
        oldValue = originalData[field];
        displayName = this.getFieldDisplayName(field);
      }

      changes.push({
        field,
        oldValue,
        newValue,
        displayName
      });
    }

    return changes;
  }

  /**
   * Obtém nome amigável para exibição do campo
   */
  private getFieldDisplayName(field: string): string {
    const fieldNames: Record<string, string> = {
      'deliveryDate': 'Data de Entrega',
      'total': 'Valor Total',
      'subtotal': 'Subtotal',
      'discount': 'Desconto',
      'tax': 'Impostos',
      'notes': 'Observações',
      'quantity': 'Quantidade',
      'unitPrice': 'Preço Unitário',
      'width': 'Largura',
      'height': 'Altura'
    };

    return fieldNames[field] || field;
  }

  /**
   * Limpa alterações antigas
   */
  async cleanupOldChanges(organizationId: string, daysOld: number = 90): Promise<number> {
    return this.pendingChangesRepository.cleanupOldChanges(organizationId, daysOld);
  }
}

export default PendingChangesService;