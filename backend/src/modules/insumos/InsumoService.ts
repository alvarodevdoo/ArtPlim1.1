/**
 * InsumoService
 *
 * Serviço responsável pelas operações de negócio do módulo de Insumos
 * (Matérias-primas para o motor de cálculo de orçamentos dinâmicos).
 *
 * Padrão: Package by Feature – src/modules/insumos/
 */

import { PrismaClient } from '@prisma/client';
import { AppError } from '../../shared/infrastructure/errors/AppError';

// ─── Tipos de dados ───────────────────────────────────────────────────────────

export interface CreateInsumoData {
  organizationId: string;
  nome: string;
  categoria: string;
  unidadeBase: string; // Mudou de enum para string
  custoUnitario: number;
  ativo?: boolean;
}

export interface UpdateInsumoData {
  nome?: string;
  categoria?: string;
  unidadeBase?: string;
  custoUnitario?: number;
  ativo?: boolean;
}

export interface ListInsumosFilter {
  categoria?: string;
  ativo?: boolean;
}

// ─── Serviço ─────────────────────────────────────────────────────────────────

export class InsumoService {
  constructor(private prisma: any) {}

  /**
   * Lista todos os materiais (antigos insumos) de uma organização.
   */
  async list(organizationId: string, filtros: ListInsumosFilter = {}) {
    const where: any = { organizationId };

    if (filtros.categoria) {
      where.category = filtros.categoria;
    }

    if (filtros.ativo !== undefined) {
      where.active = filtros.ativo;
    }

    const materials = await this.prisma.material.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    // Mapear de volta para o formato esperado pelo frontend legado se necessário
    return materials.map((m: any) => ({
      ...m,
      nome: m.name,
      categoria: m.category,
      unidadeBase: m.unit,
      custoUnitario: m.costPerUnit,
      ativo: m.active
    }));
  }

  /**
   * Retorna as categorias distintas cadastradas.
   */
  async listCategorias(organizationId: string): Promise<string[]> {
    const result = await this.prisma.material.findMany({
      where: { organizationId },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });
    return result.map((r: any) => r.category);
  }

  /**
   * Busca um material pelo ID.
   */
  async findById(id: string, organizationId: string) {
    const material = await this.prisma.material.findFirst({
      where: { id, organizationId },
    });

    if (!material) {
      throw new AppError('Insumo/Material não encontrado.', 404);
    }

    return {
      ...material,
      nome: material.name,
      categoria: material.category,
      unidadeBase: material.unit,
      custoUnitario: material.costPerUnit,
      ativo: material.active
    };
  }

  /**
   * Cria um novo material via interface de insumos.
   */
  async create(data: CreateInsumoData) {
    // Determinar formato simplificado
    let format = 'UNIT';
    if (data.unidadeBase.toUpperCase() === 'M2') format = 'SHEET';
    if (data.unidadeBase.toUpperCase() === 'M') format = 'ROLL';

    return this.prisma.material.create({
      data: {
        organizationId: data.organizationId,
        name: data.nome,
        category: data.categoria,
        unit: data.unidadeBase.toLowerCase(),
        costPerUnit: data.custoUnitario,
        active: data.ativo ?? true,
        format: format as any,
        defaultConsumptionRule: 'FIXED',
        defaultConsumptionFactor: 1.0
      },
    });
  }

  /**
   * Atualiza os dados de um material.
   */
  async update(id: string, organizationId: string, data: UpdateInsumoData) {
    await this.findById(id, organizationId);

    return this.prisma.material.update({
      where: { id },
      data: {
        ...(data.nome !== undefined && { name: data.nome }),
        ...(data.categoria !== undefined && { category: data.categoria }),
        ...(data.unidadeBase !== undefined && { unit: data.unidadeBase.toLowerCase() }),
        ...(data.custoUnitario !== undefined && { costPerUnit: data.custoUnitario }),
        ...(data.ativo !== undefined && { active: data.ativo }),
      },
    });
  }

  /**
   * Alterna o status ativo/inativo.
   */
  async toggleStatus(id: string, organizationId: string) {
    const material = await this.findById(id, organizationId);

    return this.prisma.material.update({
      where: { id },
      data: { active: !material.ativo },
    });
  }

  /**
   * Remove permanentemente.
   */
  async delete(id: string, organizationId: string) {
    await this.findById(id, organizationId);
    return this.prisma.material.delete({ where: { id } });
  }

  // ─── Fornecedores ──────────────────────────────────────────────────────────

  async addFornecedor(insumoId: string, organizationId: string, data: { fornecedorId: string, precoCusto?: number, referencia?: string, ativo?: boolean }) {
    await this.findById(insumoId, organizationId);

    if (data.ativo) {
      await this.prisma.insumoFornecedor.updateMany({
        where: { insumoId },
        data: { ativo: false }
      });
    }

    return this.prisma.insumoFornecedor.upsert({
      where: {
        insumoId_fornecedorId: {
          insumoId,
          fornecedorId: data.fornecedorId
        }
      },
      update: {
        precoCusto: data.precoCusto,
        referencia: data.referencia,
        ativo: data.ativo ?? false
      },
      create: {
        insumoId,
        fornecedorId: data.fornecedorId,
        precoCusto: data.precoCusto,
        referencia: data.referencia,
        ativo: data.ativo ?? false
      }
    });
  }

  async listFornecedores(insumoId: string, organizationId: string) {
    await this.findById(insumoId, organizationId);

    return this.prisma.insumoFornecedor.findMany({
      where: { insumoId },
      include: {
        fornecedor: {
          select: { id: true, name: true, document: true, email: true }
        }
      },
      orderBy: { ativo: 'desc' }
    });
  }

  async setFornecedorAtivo(insumoId: string, relationId: string, organizationId: string) {
    await this.findById(insumoId, organizationId);

    await this.prisma.insumoFornecedor.updateMany({
      where: { insumoId },
      data: { ativo: false }
    });

    return this.prisma.insumoFornecedor.update({
      where: { id: relationId },
      data: { ativo: true }
    });
  }

  async removeFornecedor(insumoId: string, relationId: string, organizationId: string) {
    await this.findById(insumoId, organizationId);
    return this.prisma.insumoFornecedor.delete({ where: { id: relationId } });
  }
}
