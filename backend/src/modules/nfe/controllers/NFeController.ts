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
        minStockQuantity: z.number().nonnegative().optional(),
        width: z.number().positive().optional(),
        height: z.number().positive().optional(),
      }).passthrough()),
      costDistributionMode: z.enum(['STRICT', 'REDISTRIBUTE']).optional(),
      extraFreightCost: z.number().nonnegative().optional(),
      extraTaxesCost: z.number().nonnegative().optional(),
      extraOtherCost: z.number().nonnegative().optional()
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

      // Traduz erros conhecidos para mensagens claras ao usuário
      const friendlyMessage = (() => {
        if (error?.code === 'P2002') {
          const target = Array.isArray(error?.meta?.target) ? error.meta.target.join(', ') : String(error?.meta?.target || '');
          if (target.includes('name')) {
            return 'Já existe um insumo com este nome no catálogo. Marque o item para "Vincular ao existente" no mapeamento.';
          }
          return `Valor duplicado em campo único (${target}).`;
        }
        if (error?.code === 'P2003') {
          return 'Referência inválida: verifique se a categoria, conta contábil ou fornecedor selecionado ainda existe.';
        }
        if (error?.code === 'P2025') {
          return 'Registro não encontrado. Recarregue a página e tente novamente.';
        }
        if (error?.name === 'AppError' && error?.message) {
          return error.message;
        }
        // Fallback genérico — não vaza stack trace do Prisma para o usuário
        return 'Não foi possível importar a NF-e. Confira os dados e tente novamente.';
      })();

      return reply.code(400).send({
        success: false,
        message: friendlyMessage
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
      const message = error instanceof z.ZodError
        ? `Chave de acesso inválida: ${error.errors[0]?.message || 'verifique o formato.'}`
        : (error?.name === 'AppError' ? error.message : 'Não foi possível buscar a nota na SEFAZ. Verifique sua conexão e se o certificado está configurado corretamente.');
      return reply.code(400).send({
        success: false,
        message
      });
    }
  }

  async listImports(request: FastifyRequest, reply: FastifyReply) {
    const prisma = getTenantClient(request.user!.organizationId);
    const receipts = await prisma.materialReceipt.findMany({
      where: {
        organizationId: request.user!.organizationId,
        invoiceNumber: { not: null }
      },
      include: {
        supplier: { select: { name: true, document: true } },
        items: { select: { id: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 200
    });

    const data = receipts.map((r: any) => {
      let meta: any = {};
      try { meta = r.notes ? JSON.parse(r.notes) : {}; } catch { meta = {}; }
      // Considera "chave de acesso" apenas invoiceNumber com 44 caracteres (NF-e)
      const isNfe = typeof r.invoiceNumber === 'string' && r.invoiceNumber.length === 44;
      return {
        id: r.id,
        chaveAcesso: isNfe ? r.invoiceNumber : null,
        invoiceNumber: r.invoiceNumber,
        nfeNumero: meta.nfeNumero || null,
        issueDate: r.issueDate,
        importedAt: r.createdAt,
        totalAmount: r.totalAmount,
        supplierName: r.supplier?.name || '—',
        supplierDocument: r.supplier?.document || null,
        itemsImported: r.items.length,
        itemsSkipped: Array.isArray(meta.skippedItems) ? meta.skippedItems.length : 0,
        isReimport: !!meta.isReimport,
        skippedItems: meta.skippedItems || [],
        extras: meta.extras || null
      };
    });

    return reply.send({ success: true, data });
  }

  async checkImport(request: FastifyRequest, reply: FastifyReply) {
    const schema = z.object({ chave: z.string().length(44, 'A chave deve ter 44 dígitos') });
    let chave: string;
    try {
      ({ chave } = schema.parse(request.query));
    } catch (err: any) {
      return reply.code(400).send({ success: false, message: 'Chave inválida.' });
    }

    const prisma = getTenantClient(request.user!.organizationId);
    const receipts = await prisma.materialReceipt.findMany({
      where: { organizationId: request.user!.organizationId, invoiceNumber: chave },
      include: { items: { select: { notes: true } } },
      orderBy: { createdAt: 'desc' }
    });

    const importedCodes = new Set<string>();
    for (const r of receipts) {
      for (const it of r.items) {
        try {
          const meta = it.notes ? JSON.parse(it.notes) : null;
          if (meta?.nfeItemCode) importedCodes.add(String(meta.nfeItemCode));
        } catch {}
      }
    }

    return reply.send({
      success: true,
      data: {
        exists: receipts.length > 0,
        importsCount: receipts.length,
        lastImportedAt: receipts[0]?.createdAt || null,
        importedCodes: Array.from(importedCodes)
      }
    });
  }
}
