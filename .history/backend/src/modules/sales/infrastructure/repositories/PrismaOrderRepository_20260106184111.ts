import { Order } from '../../domain/entities/Order';
import { OrderItem } from '../../domain/entities/OrderItem';
import { OrderNumber } from '../../domain/value-objects/OrderNumber';
import { OrderStatus, OrderStatusEnum } from '../../domain/value-objects/OrderStatus';
import { OrderRepository, OrderFilters, OrderStats } from '../../domain/repositories/OrderRepository';
import { Money } from '../../../../shared/domain/value-objects/Money';
import { Dimensions } from '../../../../shared/domain/value-objects/Dimensions';

export class PrismaOrderRepository implements OrderRepository {
  constructor(private prisma: any) {}

  async save(order: Order): Promise<Order> {
    const data = order.toJSON();
    
    if (order.id) {
      // Atualizar pedido existente
      const updatedOrder = await this.prisma.$transaction(async (tx: any) => {
        // Remover itens existentes
        await tx.orderItem.deleteMany({
          where: { orderId: order.id }
        });

        // Atualizar pedido
        const updated = await tx.order.update({
          where: { id: order.id },
          data: {
            customerId: data.customerId,
            status: data.status,
            subtotal: data.subtotal,
            discount: data.discount,
            tax: data.tax,
            total: data.total,
            deliveryDate: data.deliveryDate,
            validUntil: data.validUntil,
            notes: data.notes,
            updatedAt: new Date(),
            items: {
              create: data.items.map((item: any) => ({
                productId: item.productId,
                width: item.width,
                height: item.height,
                quantity: item.quantity,
                costPrice: item.costPrice,
                calculatedPrice: item.calculatedPrice,
                unitPrice: item.unitPrice,
                totalPrice: item.totalPrice,
                notes: item.notes,
                area: item.area,
                paperSize: item.paperSize,
                paperType: item.paperType,
                printColors: item.printColors,
                finishing: item.finishing,
                machineTime: item.machineTime,
                setupTime: item.setupTime,
                complexity: item.complexity,
                customSizeName: item.customSizeName,
                isCustomSize: item.isCustomSize
              }))
            }
          },
          include: {
            items: true
          }
        });

        return updated;
      });

      return this.toDomain(updatedOrder);
    } else {
      // Criar novo pedido
      const createdOrder = await this.prisma.order.create({
        data: {
          orderNumber: data.orderNumber,
          customerId: data.customerId,
          organizationId: data.organizationId,
          status: data.status,
          subtotal: data.subtotal,
          discount: data.discount,
          tax: data.tax,
          total: data.total,
          deliveryDate: data.deliveryDate,
          validUntil: data.validUntil,
          notes: data.notes,
          items: {
            create: data.items.map((item: any) => ({
              productId: item.productId,
              width: item.width,
              height: item.height,
              quantity: item.quantity,
              costPrice: item.costPrice,
              calculatedPrice: item.calculatedPrice,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              notes: item.notes,
              area: item.area,
              paperSize: item.paperSize,
              paperType: item.paperType,
              printColors: item.printColors,
              finishing: item.finishing,
              machineTime: item.machineTime,
              setupTime: item.setupTime,
              complexity: item.complexity,
              customSizeName: item.customSizeName,
              isCustomSize: item.isCustomSize
            }))
          }
        },
        include: {
          items: true
        }
      });

      return this.toDomain(createdOrder);
    }
  }

  async findById(id: string): Promise<Order | null> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                description: true
              }
            }
          }
        },
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            state: true,
            zipCode: true
          }
        }
      }
    });

    return order ? this.toDomain(order) : null;
  }

  async findByOrderNumber(orderNumber: OrderNumber): Promise<Order | null> {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber: orderNumber.value },
      include: {
        items: true,
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        }
      }
    });

    return order ? this.toDomain(order) : null;
  }

  async findAll(filters?: OrderFilters): Promise<Order[]> {
    const whereClause: any = {};
    
    if (filters?.organizationId) {
      whereClause.organizationId = filters.organizationId;
    }
    
    if (filters?.customerId) {
      whereClause.customerId = filters.customerId;
    }
    
    if (filters?.status) {
      whereClause.status = filters.status;
    }
    
    if (filters?.search) {
      whereClause.OR = [
        { orderNumber: { contains: filters.search, mode: 'insensitive' } },
        { customer: { name: { contains: filters.search, mode: 'insensitive' } } }
      ];
    }
    
    if (filters?.dateFrom || filters?.dateTo) {
      whereClause.createdAt = {};
      if (filters.dateFrom) {
        whereClause.createdAt.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        whereClause.createdAt.lte = filters.dateTo;
      }
    }
    
    if (filters?.customer) {
      whereClause.customer = {
        name: { contains: filters.customer, mode: 'insensitive' }
      };
    }

    const orders = await this.prisma.order.findMany({
      where: whereClause,
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                description: true
              }
            }
          }
        },
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return orders.map((order: any) => this.toDomain(order));
  }

  async delete(id: string): Promise<void> {
    await this.prisma.order.delete({
      where: { id }
    });
  }

  async getNextSequence(): Promise<number> {
    const count = await this.prisma.order.count();
    return count + 1;
  }

  async getStats(organizationId: string): Promise<OrderStats> {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalOrders,
      totalValue,
      ordersByStatus,
      currentMonthOrders,
      lastMonthOrders
    ] = await Promise.all([
      this.prisma.order.count({
        where: { organizationId }
      }),
      this.prisma.order.aggregate({
        where: { organizationId },
        _sum: {
          total: true
        }
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        where: { organizationId },
        _count: {
          id: true
        },
        _sum: {
          total: true
        }
      }),
      this.prisma.order.count({
        where: {
          organizationId,
          createdAt: {
            gte: currentMonth
          }
        }
      }),
      this.prisma.order.count({
        where: {
          organizationId,
          createdAt: {
            gte: lastMonth,
            lt: currentMonth
          }
        }
      })
    ]);

    const avgOrderValue = totalOrders > 0 ? Number(totalValue._sum.total || 0) / totalOrders : 0;
    const monthlyGrowth = lastMonthOrders > 0 
      ? ((currentMonthOrders - lastMonthOrders) / lastMonthOrders) * 100 
      : 0;

    const byStatus = ordersByStatus.reduce((acc: any, item: any) => {
      acc[item.status] = {
        count: item._count.id,
        value: Number(item._sum.total || 0)
      };
      return acc;
    }, {});

    const pendingValue = ordersByStatus
      .filter((item: any) => ['DRAFT', 'APPROVED', 'IN_PRODUCTION'].includes(item.status))
      .reduce((sum: number, item: any) => sum + Number(item._sum.total || 0), 0);

    const overdueCount = await this.prisma.order.count({
      where: {
        organizationId,
        status: 'DRAFT',
        validUntil: {
          lt: now
        }
      }
    });

    return {
      total: totalOrders,
      totalValue: Number(totalValue._sum.total || 0),
      byStatus,
      avgOrderValue,
      monthlyGrowth,
      pendingValue,
      overdueCount
    };
  }

  async findExpiredOrders(organizationId: string): Promise<Order[]> {
    const now = new Date();
    
    const orders = await this.prisma.order.findMany({
      where: {
        organizationId,
        status: 'DRAFT',
        validUntil: {
          lt: now
        }
      },
      include: {
        items: true
      }
    });

    return orders.map((order: any) => this.toDomain(order));
  }

  private toDomain(prismaOrder: any): Order {
    const items = prismaOrder.items.map((item: any) => new OrderItem({
      id: item.id,
      productId: item.productId,
      dimensions: new Dimensions(item.width, item.height),
      quantity: item.quantity,
      costPrice: new Money(Number(item.costPrice)),
      calculatedPrice: new Money(Number(item.calculatedPrice)),
      unitPrice: new Money(Number(item.unitPrice)),
      notes: item.notes,
      area: item.area,
      paperSize: item.paperSize,
      paperType: item.paperType,
      printColors: item.printColors,
      finishing: item.finishing,
      machineTime: item.machineTime,
      setupTime: item.setupTime,
      complexity: item.complexity,
      customSizeName: item.customSizeName,
      isCustomSize: item.isCustomSize
    }));

    return new Order({
      id: prismaOrder.id,
      orderNumber: new OrderNumber(prismaOrder.orderNumber),
      customerId: prismaOrder.customerId,
      organizationId: prismaOrder.organizationId,
      status: new OrderStatus(prismaOrder.status as OrderStatusEnum),
      items,
      subtotal: new Money(Number(prismaOrder.subtotal)),
      discount: new Money(Number(prismaOrder.discount)),
      tax: new Money(Number(prismaOrder.tax)),
      total: new Money(Number(prismaOrder.total)),
      deliveryDate: prismaOrder.deliveryDate,
      validUntil: prismaOrder.validUntil,
      notes: prismaOrder.notes,
      createdAt: prismaOrder.createdAt,
      updatedAt: prismaOrder.updatedAt
    });
  }
}