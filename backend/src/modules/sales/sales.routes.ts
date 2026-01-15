import { FastifyInstance } from 'fastify';
import { prisma } from '../../shared/infrastructure/database/prisma';
import { SalesModule } from './SalesModule';

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

export async function salesRoutes(fastify: FastifyInstance) {
  // Serviços temporários (devem ser substituídos pelos módulos apropriados)
  const customerService = new TempCustomerService(prisma);
  const productService = new TempProductService(prisma);
  const organizationService = new TempOrganizationService(prisma);

  // Módulo de vendas
  const salesModule = new SalesModule(
    prisma,
    customerService,
    productService,
    organizationService
  );

  // Registrar rotas do módulo
  await salesModule.registerRoutes(fastify);
}