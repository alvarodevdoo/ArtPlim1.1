import { PrismaClient } from '@prisma/client';

export class QueryOptimizer {
  constructor(private prisma: PrismaClient) { }

  // Otimizar consulta de produtos com componentes
  async getOptimizedProducts(organizationId: string, limit: number = 50, offset: number = 0) {
    return await this.prisma.product.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        description: true,
        productType: true,
        localFormulaId: true,
        pricingRuleId: true,
        pricingMode: true,
        salePrice: true,
        active: true,
        formulaData: true,
        pricingRule: true,
        components: {
          select: {
            id: true,
            consumptionMethod: true,
            wastePercentage: true,
            material: {
              select: {
                id: true,
                name: true,
                format: true,
                costPerUnit: true,
                unit: true
              }
            }
          }
        },
        _count: {
          select: {
            orderItems: true
          }
        }
      },
      orderBy: { name: 'asc' },
      take: limit,
      skip: offset
    });
  }

  // Otimizar consulta de pedidos com itens
  async getOptimizedOrders(organizationId: string, limit: number = 20, offset: number = 0, search?: string) {
    const where: any = { organizationId };

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { customer: { phone: { contains: search, mode: 'insensitive' } } }
      ];
    }

    return await this.prisma.order.findMany({
      where,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        createdAt: true,
        deliveryDate: true,
        updatedAt: true,
        processStatusId: true,
        processStatus: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
            mappedBehavior: true,
            allowEdition: true
          }
        },
        approvedAt: true,
        inProductionAt: true,
        finishedAt: true,
        deliveredAt: true,
        cancelledAt: true,
        cancelledById: true,
        cancellationReason: true,
        cancellationPaymentAction: true,
        cancellationRefundAmount: true,
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        productionQueue: {
          select: {
            actualStart: true,
            actualEnd: true,
            createdAt: true
          },
          take: 1,
          orderBy: { createdAt: 'desc' }
        },
        transactions: {
          select: {
            amount: true,
            type: true,
            status: true
          }
        },
        items: {
          select: {
            id: true,
            width: true,
            height: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
            product: {
              select: {
                id: true,
                name: true,
                pricingMode: true
              }
            },
            status: true,
            processStatusId: true,
            processStatus: {
              select: {
                id: true,
                name: true,
                color: true,
                mappedBehavior: true
              }
            }
          }
        },
        statusHistory: {
          select: {
            id: true,
            fromStatus: true,
            toStatus: true,
            fromProcessStatusId: true,
            toProcessStatusId: true,
            toProcessStatus: {
              select: { name: true, color: true }
            },
            notes: true,
            createdAt: true,
            user: { select: { name: true } }
          },
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });
  }

  // Otimizar consulta de materiais com estoque
  async getOptimizedMaterials(organizationId: string) {
    return await this.prisma.material.findMany({
      where: { organizationId, active: true },
      select: {
        id: true,
        name: true,
        category: true,
        description: true,
        format: true,
        costPerUnit: true,
        unit: true,
        controlUnit: true,
        conversionFactor: true,
        width: true,
        height: true,
        active: true,
        defaultConsumptionRule: true,
        defaultConsumptionFactor: true,
        inventoryAccountId: true,
        expenseAccountId: true,
        minStockQuantity: true,
        sellWithoutStock: true,
        trackStock: true,
        spedType: true,
        averageCost: true,
        currentStock: true,
        inventoryAccount: {
          select: { id: true, name: true, code: true }
        },
        expenseAccount: {
          select: { id: true, name: true, code: true }
        },
        _count: {
          select: {
            components: true,
            inventoryItems: true
          }
        },
        components: {
          select: {
            id: true,
            product: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    });
  }

  // Consulta otimizada para cálculo de materiais
  async getProductWithComponents(productId: string) {
    return await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        localFormulaId: true,
        pricingRuleId: true,
        pricingMode: true,
        salePrice: true,
        minPrice: true,
        markup: true,
        formulaData: true,
        pricingRule: true,
        components: {
          select: {
            id: true,
            consumptionMethod: true,
            wastePercentage: true,
            wasteUnits: true,
            manualWastePercentage: true,
            manualWasteUnits: true,
            material: {
              select: {
                id: true,
                name: true,
                format: true,
                costPerUnit: true,
                unit: true,
                controlUnit: true,
                conversionFactor: true,
                width: true,
                height: true
              }
            }
          }
        }
      }
    });
  }

  // Otimizar consulta de clientes
  async getOptimizedCustomers(organizationId: string, limit: number = 50) {
    return await this.prisma.profile.findMany({
      where: {
        organizationId,
        isCustomer: true
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        document: true,
        type: true,
        isCustomer: true,
        address: true,
        addressNumber: true,
        city: true,
        state: true,
        zipCode: true,
        createdAt: true,
        _count: {
          select: {
            orders: {
              where: {
                status: { not: 'CANCELLED' }
              }
            }
          }
        }
      },
      orderBy: { name: 'asc' },
      take: limit
    });
  }

  // Otimizar consulta de funcionários
  async getOptimizedEmployees(organizationId: string, limit: number = 50) {
    return await this.prisma.profile.findMany({
      where: {
        organizationId,
        isEmployee: true
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        document: true,
        type: true,
        isEmployee: true,
        active: true,
        address: true,
        addressNumber: true,
        city: true,
        state: true,
        zipCode: true,
        createdAt: true,
        _count: {
          select: {
            orders: {
              where: {
                status: { not: 'CANCELLED' }
              }
            }
          }
        },
        user: {
          select: {
            role: true
          }
        }
      },
      orderBy: { name: 'asc' },
      take: limit
    });
  }

  // Consulta otimizada para dashboard
  async getDashboardStats(organizationId: string, startDate: Date, endDate: Date) {
    const [orderStats, revenueStats, productStats] = await Promise.all([
      // Estatísticas de pedidos
      this.prisma.order.groupBy({
        by: ['status'],
        where: {
          organizationId,
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        _count: {
          id: true
        },
        _sum: {
          total: true
        }
      }),

      // Receita por período
      this.prisma.order.findMany({
        where: {
          organizationId,
          status: 'DELIVERED',
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        select: {
          total: true,
          createdAt: true
        }
      }),

      // Top produtos
      this.prisma.orderItem.groupBy({
        by: ['productId'],
        where: {
          order: {
            organizationId,
            status: 'DELIVERED',
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          }
        },
        _sum: {
          totalPrice: true,
          quantity: true
        },
        _count: {
          id: true
        },
        orderBy: {
          _sum: {
            totalPrice: 'desc'
          }
        },
        take: 10
      })
    ]);

    return {
      orderStats,
      revenueStats,
      productStats
    };
  }

  // Criar índices otimizados
  async createOptimizedIndexes() {
    const indexes = [
      // Índices para produtos
      'CREATE INDEX IF NOT EXISTS idx_products_org_active ON products("organizationId", active) WHERE active = true',
      'CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)',

      // Índices para pedidos
      'CREATE INDEX IF NOT EXISTS idx_orders_org_status ON orders("organizationId", status)',
      'CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders("createdAt")',
      'CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders("customerId")',

      // Índices para itens de pedido
      'CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items("orderId")',
      'CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items("productId")',

      // Índices para materiais
      'CREATE INDEX IF NOT EXISTS idx_materials_org_active ON materials("organizationId", active) WHERE active = true',
      'CREATE INDEX IF NOT EXISTS idx_materials_format ON materials(format)',

      // Índices para componentes
      'CREATE INDEX IF NOT EXISTS idx_components_product ON product_components("productId")',
      'CREATE INDEX IF NOT EXISTS idx_components_material ON product_components("materialId")',

      // Índices para profiles (clientes)
      'CREATE INDEX IF NOT EXISTS idx_profiles_org_customer ON profiles("organizationId", "isCustomer") WHERE "isCustomer" = true',
      'CREATE INDEX IF NOT EXISTS idx_profiles_document ON profiles(document)',

      // Índices compostos para analytics
      'CREATE INDEX IF NOT EXISTS idx_orders_analytics ON orders("organizationId", status, "createdAt")',
      'CREATE INDEX IF NOT EXISTS idx_order_items_analytics ON order_items("orderId", "productId", "totalPrice")'
    ];

    console.log('🔧 Criando índices otimizados...');

    for (const indexQuery of indexes) {
      try {
        await this.prisma.$executeRawUnsafe(indexQuery);
        console.log(`✅ Índice criado: ${indexQuery.split(' ')[5]}`);
      } catch (error) {
        console.log(`⚠️ Índice já existe ou erro: ${indexQuery.split(' ')[5]}`);
      }
    }

    console.log('✅ Índices otimizados criados/verificados');
  }

  // Analisar performance de queries
  async analyzeQueryPerformance() {
    try {
      const slowQueries = await this.prisma.$queryRaw`
        SELECT 
          query,
          calls,
          total_time,
          mean_time,
          rows
        FROM pg_stat_statements 
        WHERE query LIKE '%products%' OR query LIKE '%orders%'
        ORDER BY mean_time DESC 
        LIMIT 10
      `;

      console.log('📊 Top 10 queries mais lentas:');
      console.table(slowQueries);

      return slowQueries;
    } catch (error) {
      console.log('⚠️ pg_stat_statements não disponível. Instale a extensão para análise de performance.');
      return [];
    }
  }

  // Limpar cache de queries
  async clearQueryCache() {
    try {
      await this.prisma.$executeRaw`SELECT pg_stat_reset()`;
      console.log('✅ Cache de queries limpo');
    } catch (error) {
      console.log('⚠️ Erro ao limpar cache de queries:', error);
    }
  }

  // Estatísticas de uso do banco
  async getDatabaseStats() {
    try {
      const stats = await this.prisma.$queryRaw`
        SELECT 
          schemaname,
          tablename,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          n_live_tup as live_rows,
          n_dead_tup as dead_rows
        FROM pg_stat_user_tables 
        ORDER BY n_live_tup DESC
      `;

      console.log('📊 Estatísticas das tabelas:');
      console.table(stats);

      return stats;
    } catch (error) {
      console.log('⚠️ Erro ao obter estatísticas do banco:', error);
      return [];
    }
  }
}