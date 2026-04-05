import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { NFeParserService } from '../services/NFeParserService';
import { NFeImportService } from '../services/NFeImportService';
import { getTenantClient } from '../../../shared/infrastructure/database/tenant';

export class NFeController {
  
  async parseXml(request: FastifyRequest, reply: FastifyReply) {
    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ success: false, message: 'Nenhum arquivo XML enviado.' });
    }

    const fileBuffer = await data.toBuffer();
    const xmlContent = fileBuffer.toString('utf-8');

    const parserService = new NFeParserService();
    try {
      const result = parserService.parse(xmlContent);
      return reply.code(200).send({ success: true, data: result });
    } catch (error: any) {
      request.log.error(error);
      return reply.code(400).send({ success: false, message: `Erro ao processar XML: ${error.message}` });
    }
  }

  async importProcessedXml(request: FastifyRequest, reply: FastifyReply) {
    const importSchema = z.object({
      chaveAcesso: z.string(),
      dataEmissao: z.string(),
      valorTotalNota: z.number(),
      numero: z.coerce.string().optional(),
      serie: z.coerce.string().optional(),
      emitente: z.object({
        cnpj: z.coerce.string(),
        razaoSocial: z.string(),
        nomeFantasia: z.string(),
        endereco: z.any().optional(),
      }).passthrough(),
      items: z.array(z.object({
        codigo: z.string(),
        descricao: z.string(),
        quantidade: z.number(),
        valorUnitario: z.number(),
        valorTotal: z.number(),
        unidade: z.string().optional(),
        ncm: z.coerce.string().optional(),
        ean: z.coerce.string().optional(),
        custoEfetivoUnitario: z.number().optional(), 
        custosAcessorios: z.object({
          frete: z.number().optional(),
          ipi: z.number().optional(),
          st: z.number().optional(),
          difal: z.number().optional()
        }).passthrough().optional(),
        mappedMaterialId: z.string().optional(),
        createNew: z.boolean().optional(),
        skip: z.boolean().optional(),
        categoryId: z.string().optional(),
        materialTypeId: z.string().optional(),
        inventoryAccountId: z.string().optional(),
        expenseAccountId: z.string().optional(),
      }).passthrough()),
      costDistributionMode: z.enum(['STRICT', 'REDISTRIBUTE']).optional()
    }).passthrough();

    let body;
    try {
      body = importSchema.parse(request.body);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return reply.code(400).send({ 
          success: false, 
          message: 'Erro de validação nos dados da nota', 
          errors: err.errors 
        });
      }
      throw err;
    }

    const prisma = getTenantClient(request.user!.organizationId);
    const importService = new NFeImportService(prisma);

    try {
      const receipt = await importService.importNFe(
        request.user!.organizationId,
        request.user!.userId,
        body as any
      );
      return reply.code(201).send({ success: true, data: receipt });
    } catch (error: any) {
      request.log.error(error);
      return reply.code(400).send({ 
        success: false, 
        message: `Erro na importação: ${error.message}`,
        error: error.name,
        details: error.meta // Prisma errors usually have meta
      });
    }
  }
}
