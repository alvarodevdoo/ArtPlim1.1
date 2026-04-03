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
      emitente: z.object({
        cnpj: z.string(),
        razaoSocial: z.string(),
        nomeFantasia: z.string(),
        endereco: z.any().optional(),
      }),
      items: z.array(z.object({
        codigo: z.string(),
        descricao: z.string(),
        quantidade: z.number(),
        valorUnitario: z.number(),
        valorTotal: z.number(),
        custoEfetivoUnitario: z.number().optional(), // opcional para manter retrocompatibilidade
        custosAcessorios: z.object({
          frete: z.number(),
          ipi: z.number(),
          st: z.number(),
          difal: z.number()
        }).optional(),
        mappedMaterialId: z.string(),
        createNew: z.boolean().optional(),
        newMaterialCategory: z.string().optional(),
      }))
    });

    const body = importSchema.parse(request.body);
    const prisma = getTenantClient(request.user!.organizationId);
    const importService = new NFeImportService(prisma);

    try {
      const receipt = await importService.importNFe(
        request.user!.organizationId,
        request.user!.userId,
        body
      );
      return reply.code(201).send({ success: true, data: receipt });
    } catch (error: any) {
      request.log.error(error);
      return reply.code(400).send({ success: false, message: `Erro na importação: ${error.message}` });
    }
  }
}
