import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getTenantClient } from '../../../../shared/infrastructure/database/tenant';
import { SalesReportService } from '../../services/SalesReportService';

const periodQuerySchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  sellerId: z.string().optional(),
});

/**
 * Controller responsável pelo relatório consolidado de vendas.
 * Atua como uma fina camada HTTP: parse + instancia o service por tenant e devolve o payload.
 * A regra de negócio fica no SalesReportService (SRP).
 */
export class SalesReportController {
  async getSalesReport(request: FastifyRequest, reply: FastifyReply) {
    const query = periodQuerySchema.parse(request.query);
    const prisma = getTenantClient(request.user!.organizationId);
    const service = new SalesReportService(prisma);

    const report = await service.generate({
      organizationId: request.user!.organizationId,
      startDate: new Date(query.startDate),
      endDate: new Date(query.endDate),
      sellerId: query.sellerId || undefined,
    });

    return reply.send({ success: true, data: report });
  }
}
