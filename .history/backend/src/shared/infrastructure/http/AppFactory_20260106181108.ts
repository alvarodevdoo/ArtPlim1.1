import { FastifyInstance } from 'fastify';
import { prisma } from '../database/prisma';
import { SalesModule } from '../../modules/sales-new/SalesModule';

// Implementações temporárias dos serviços (devem ser movidas para seus respectivos módulos)
class TempCustomerService {
  constructor(private prisma: any) {}
  
  async findById(id: string) {
    return await this.prisma.profile.findUnique({
      where: { id },
      select: { id: true, organizationId: true }
    });
  }
}

class TempProductService {
  constructor(private prisma: any) {}
  
  async findById(id: string) {
    return await this.prisma.product.findUnique({
      where: { id },
      include: {
        components: { include: { material: true } },
        operations: true
      }
    });
  }
}

class TempOrganizationService {
  constructor(private prisma: any) {}
  
  async getSettings(organizationId: string) {
    return await this.prisma.organizationSettings.findFirst({
      where: { organizationId }
    });
  }
}

export class AppFactory {
  static async createApp(fastify: FastifyInstance): Promise<void> {
    // Serviços temporários (devem ser substituídos pelos módulos apropriados)
    const customerService = new TempCustomerService(prisma);
    const productService = new TempProductService(prisma);
    const organizationService = new TempOrganizationService(prisma);

    // Módulos
    const salesModule = new SalesModule(
      prisma,
      customerService,
      productService,
      organizationService
    );

    // Registrar rotas dos módulos
    await fastify.register(async function (fastify) {
      await salesModule.registerRoutes(fastify);
    }, { prefix: '/api/sales' });
  }
}