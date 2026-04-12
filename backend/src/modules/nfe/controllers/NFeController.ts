import { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { NFeParserService } from '../services/NFeParserService';
import { NFeImportService } from '../services/NFeImportService';
import { NFeFetchService } from '../services/NFeFetchService';
import { getTenantClient } from '../../../shared/infrastructure/database/tenant';

export class NFeController {
  
  private async autoMapItems(organizationId: string, rawResult: any, prisma: any) {
    if (!rawResult?.emitente?.cnpj || !rawResult?.items?.length) return rawResult;

    const cnpj = String(rawResult.emitente.cnpj).replace(/\D/g, '');
    const supplier = await prisma.profile.findFirst({
      where: { 
        organizationId, 
        document: cnpj,
        isSupplier: true
      }
    });

    if (!supplier) return rawResult;

    const mappings = await prisma.materialSupplier.findMany({
      where: { supplierId: supplier.id },
      include: {
        material: {
          select: { multiplicador_padrao_entrada: true }
        }
      }
    });

    if (!mappings.length) return rawResult;
    
    // Create map holding both materialId and the multiplier
    const mapCodeToData = new Map(mappings.map((m: any) => [
      m.supplierCode, 
      { id: m.materialId, multiplier: m.material?.multiplicador_padrao_entrada || 1 }
    ]));

    rawResult.items = rawResult.items.map((item: any) => {
      const match = mapCodeToData.get(String(item.codigo));
      if (match) {
        item.mappedMaterialId = match.id;
        
        // Multiplica a quantidade pelo fator da embalagem se maior que 1 e ajusta o custo unitário.
        if (match.multiplier > 1) {
          const originalQtde = item.quantidadeOriginal ?? item.quantidade;
          item.quantidade = originalQtde * match.multiplier;
          item.custoEfetivoUnitario = item.valorTotal / item.quantidade;
        }
      }
      return item;
    });

    return rawResult;
  }

  async parseXml(request: FastifyRequest, reply: FastifyReply) {
    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ success: false, message: 'Nenhum arquivo XML enviado.' });
    }

    const fileBuffer = await data.toBuffer();
    const xmlContent = fileBuffer.toString('utf-8');

    const parserService = new NFeParserService();
    const prisma = getTenantClient(request.user!.organizationId);
    
    try {
      let result = parserService.parse(xmlContent);
      result = await this.autoMapItems(request.user!.organizationId, result, prisma);

      return reply.code(200).send({ success: true, data: result });
    } catch (error: any) {
      request.log.error(error);
      return reply.code(400).send({ success: false, message: `Erro ao processar XML: ${error.message}`, stack: error.stack });
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
        codigo: z.coerce.string(),
        descricao: z.string(),
        quantidade: z.number(),
        valorUnitario: z.number(),
        valorTotal: z.number(),
        unidade: z.coerce.string().optional(),
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
        request.log.error({ zodErrors: err.errors }, 'Erro de validação no import da NF-e');
        return reply.code(400).send({ 
          success: false, 
          message: `Erro de validação: ${err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
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

  async fetchByChave(request: FastifyRequest, reply: FastifyReply) {
    const fetchSchema = z.object({
      chave: z.string().length(44, 'A chave de acesso deve ter 44 dígitos')
    });

    try {
      const { chave } = fetchSchema.parse(request.body);
      const prisma = getTenantClient(request.user!.organizationId);
      const fetchService = new NFeFetchService(prisma);

      let result = await fetchService.fetchByChave(request.user!.organizationId, chave);
      result = await this.autoMapItems(request.user!.organizationId, result, prisma);
      
      return reply.code(200).send({ success: true, data: result });
    } catch (error: any) {
      request.log.error(error);
      return reply.code(error instanceof z.ZodError ? 400 : 400).send({
        success: false,
        message: error.message || 'Erro ao buscar nota na SEFAZ',
        stack: error.stack
      });
    }
  }
}
