/**
 * FichaTecnicaService
 * 
 * Gerencia a composição de insumos (matérias-primas) de um Produto 
 * ou de uma Opção de Variação (ProductConfigurationOption).
 */

import { PrismaClient } from '@prisma/client';
import { AppError } from '../../../shared/infrastructure/errors/AppError';

export interface FichaTecnicaItem {
  insumoId: string;
  quantidade: number;
  linkedVariable?: string;
  linkedQuantityVariable?: string;
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
    return this.prisma.$transaction(async (tx) => {
      // 1. Remover itens anteriores
      const where: any = { organizationId };
      if (productId) where.productId = productId;
      if (configurationOptionId) where.configurationOptionId = configurationOptionId;

      await tx.fichaTecnicaInsumo.deleteMany({ where });

      // 2. Buscar custos atuais dos insumos para gravar o custoCalculado (snapshot)
      const insumoIds = items.map(i => i.insumoId);
      const insumos = await tx.material.findMany({
        where: { id: { in: insumoIds }, organizationId },
        select: { id: true, costPerUnit: true }
      });

      const insumoMap = new Map(insumos.map(i => [i.id, Number(i.costPerUnit)]));

      // 3. Inserir novos itens
      const inserts = items.map(item => {
        const custoUnitario = insumoMap.get(item.insumoId) || 0;
        return {
          organizationId,
          insumoId: item.insumoId,
          productId,
          configurationOptionId,
          quantidade: item.quantidade,
          custoCalculado: custoUnitario * item.quantidade,
          linkedVariable: item.linkedVariable || null,
          linkedQuantityVariable: item.linkedQuantityVariable || null
        };
      });

      if (inserts.length > 0) {
        await tx.fichaTecnicaInsumo.createMany({
          data: inserts
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
    return items.reduce((total, item) => total + (Number(item.custoCalculado)), 0);
  }
}
