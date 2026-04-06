/**
 * FichaTecnicaService
 * 
 * Gerencia a composição de insumos (matérias-primas) de um Produto 
 * ou de uma Opção de Variação (ProductConfigurationOption).
 */

import { PrismaClient } from '@prisma/client';
import { AppError } from '../../../shared/infrastructure/errors/AppError';

export interface FichaTecnicaItem {
  insumoId?: string | null;
  quantidade: number;
  width?: number;
  height?: number;
  itemsPerUnit?: number;
  linkedVariable?: string;
  linkedQuantityVariable?: string;
  configurationGroupId?: string | null;
}

export class FichaTecnicaService {
  constructor(private prisma: any) {}

  /**
   * Salva a ficha técnica de um Produto ou de uma Opção.
   * Limpa os itens anteriores e insere os novos em uma transação.
   */
  async save(organizationId: string, data: {
    productId?: string;
    configurationOptionId?: string;
    items: FichaTecnicaItem[];
  }) {
    const { productId, configurationOptionId, items } = data;

    if (!productId && !configurationOptionId) {
      throw new AppError('É necessário informar o Produto ou a Opção para a ficha técnica.', 400);
    }

    // Executa em transação para garantir atomicidade
    return this.prisma.$transaction(async (tx: any) => {
      console.log(`[FichaTecnica] Salvando ${items.length} itens para ${productId ? 'produto ' + productId : 'opção ' + configurationOptionId}`);
      console.log('[FichaTecnica] Primeiro item:', JSON.stringify(items[0], null, 2));
      // 1. Remover itens anteriores
      const where: any = { organizationId };
      if (productId) where.productId = productId;
      if (configurationOptionId) where.configurationOptionId = configurationOptionId;

      await tx.fichaTecnicaInsumo.deleteMany({ where });

      // 2. Buscar custos atuais dos insumos (apenas os que não são nulos)
      const insumoIds = items.filter(i => i.insumoId).map(i => i.insumoId as string);
      const insumos = insumoIds.length > 0 
        ? await tx.material.findMany({
            where: { id: { in: insumoIds }, organizationId },
            select: { id: true, costPerUnit: true }
          })
        : [];

      const insumoMap = new Map(insumos.map((i: any) => [i.id, Number(i.costPerUnit)]));

      // 3. Inserir novos itens
      for (const item of items) {
        const custoUnitario = item.insumoId ? (insumoMap.get(item.insumoId) || 0) : 0;
        const quantidade = Number(item.quantidade || 0);
        
        await tx.fichaTecnicaInsumo.create({
          data: {
            organizationId,
            insumoId: item.insumoId || null,
            productId,
            configurationOptionId,
            configurationGroupId: item.configurationGroupId || null,
            quantidade,
            width: item.width != null ? Number(item.width) : null,
            height: item.height != null ? Number(item.height) : null,
            itemsPerUnit: item.itemsPerUnit != null ? Number(item.itemsPerUnit) : 1.0,
            custoCalculado: (custoUnitario as number) * quantidade,
            linkedVariable: item.linkedVariable || null,
            linkedQuantityVariable: item.linkedQuantityVariable || null
          }
        });
      }

      // Retorna os itens criados
      return tx.fichaTecnicaInsumo.findMany({
        where,
        include: { material: true }
      });
    });
  }

  /**
   * Recupera a ficha técnica de um alvo.
   */
  async getByTarget(organizationId: string, targetId: string) {
    return this.prisma.fichaTecnicaInsumo.findMany({
      where: {
        organizationId,
        OR: [
          { productId: targetId },
          { configurationOptionId: targetId }
        ]
      },
      include: {
        material: {
          select: {
            id: true,
            name: true,
            unit: true,
            costPerUnit: true,
            averageCost: true,
            description: true
          }
        }
      },
      orderBy: { material: { name: 'asc' } }
    });
  }

  /**
   * Calcula o custo total de uma ficha técnica (utilitário).
   */
  async calculateTotalCost(organizationId: string, targetId: string): Promise<number> {
    const items = await this.getByTarget(organizationId, targetId);
    return items.reduce((total: number, item: any) => total + (Number(item.custoCalculado || 0)), 0);
  }
}
