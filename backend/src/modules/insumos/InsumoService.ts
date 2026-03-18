/**
 * InsumoService
 *
 * Serviço responsável pelas operações de negócio do módulo de Insumos
 * (Matérias-primas para o motor de cálculo de orçamentos dinâmicos).
 *
 * Padrão: Package by Feature – src/modules/insumos/
 */

import { PrismaClient, UnidadeBase } from '@prisma/client';
import { AppError } from '../../shared/infrastructure/errors/AppError';

// ─── Tipos de dados ───────────────────────────────────────────────────────────

export interface CreateInsumoData {
  organizationId: string;
  nome: string;
  categoria: string;
  unidadeBase: UnidadeBase;
  custoUnitario: number;
  ativo?: boolean;
}

export interface UpdateInsumoData {
  nome?: string;
  categoria?: string;
  unidadeBase?: UnidadeBase;
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
   * Lista todos os insumos de uma organização.
   * Suporta filtragem por categoria e status ativo/inativo.
   */
  async list(organizationId: string, filtros: ListInsumosFilter = {}) {
    const where: any = { organizationId };

    if (filtros.categoria) {
      where.categoria = filtros.categoria;
    }

    // Se `ativo` não foi informado, retorna apenas os ativos por padrão
    if (filtros.ativo !== undefined) {
      where.ativo = filtros.ativo;
    }

    return this.prisma.insumo.findMany({
      where,
      orderBy: [{ categoria: 'asc' }, { nome: 'asc' }],
    });
  }

  /**
   * Retorna as categorias distintas cadastradas (para popular o <select> do form).
   */
  async listCategorias(organizationId: string): Promise<string[]> {
    const result = await this.prisma.insumo.findMany({
      where: { organizationId },
      select: { categoria: true },
      distinct: ['categoria'],
      orderBy: { categoria: 'asc' },
    });
    return result.map((r) => r.categoria);
  }

  /**
   * Busca um insumo pelo ID garantindo que pertence à organização.
   */
  async findById(id: string, organizationId: string) {
    const insumo = await this.prisma.insumo.findFirst({
      where: { id, organizationId },
    });

    if (!insumo) {
      throw new AppError('Insumo não encontrado.', 404);
    }

    return insumo;
  }

  /**
   * Cria um novo insumo.
   */
  async create(data: CreateInsumoData) {
    return this.prisma.insumo.create({
      data: {
        organizationId: data.organizationId,
        nome: data.nome,
        categoria: data.categoria,
        unidadeBase: data.unidadeBase,
        // Prisma aceita number ou Decimal—passamos como string para evitar perda de precisão
        custoUnitario: data.custoUnitario,
        ativo: data.ativo ?? true,
      },
    });
  }

  /**
   * Atualiza os dados de um insumo existente.
   * Útil para atualização de preço (custo_unitario) sem precisar
   * reenviar todos os campos.
   */
  async update(id: string, organizationId: string, data: UpdateInsumoData) {
    // Garantir que o insumo existe e pertence à organização
    await this.findById(id, organizationId);

    return this.prisma.insumo.update({
      where: { id },
      data: {
        ...(data.nome !== undefined && { nome: data.nome }),
        ...(data.categoria !== undefined && { categoria: data.categoria }),
        ...(data.unidadeBase !== undefined && { unidadeBase: data.unidadeBase }),
        ...(data.custoUnitario !== undefined && { custoUnitario: data.custoUnitario }),
        ...(data.ativo !== undefined && { ativo: data.ativo }),
      },
    });
  }

  /**
   * Alterna o status ativo/inativo de um insumo.
   */
  async toggleStatus(id: string, organizationId: string) {
    const insumo = await this.findById(id, organizationId);

    return this.prisma.insumo.update({
      where: { id },
      data: { ativo: !insumo.ativo },
    });
  }

  /**
   * Remove permanentemente um insumo.
   * ⚠ Prefer `toggleStatus` para desativação suave.
   */
  async delete(id: string, organizationId: string) {
    await this.findById(id, organizationId);
    return this.prisma.insumo.delete({ where: { id } });
  }

  // ─── Fornecedores ──────────────────────────────────────────────────────────

  /**
   * Vincula um fornecedor a um insumo.
   */
  async addFornecedor(insumoId: string, organizationId: string, data: { fornecedorId: string, precoCusto?: number, referencia?: string, ativo?: boolean }) {
    await this.findById(insumoId, organizationId);

    // Se estiver definindo como ativo, desativa os outros deste insumo
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

  /**
   * Lista fornecedores vinculados ao insumo.
   */
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

  /**
   * Define um fornecedor como o ativo/principal.
   */
  async setFornecedorAtivo(insumoId: string, relationId: string, organizationId: string) {
    await this.findById(insumoId, organizationId);

    // Desativa todos
    await this.prisma.insumoFornecedor.updateMany({
      where: { insumoId },
      data: { ativo: false }
    });

    // Ativa o selecionado
    return this.prisma.insumoFornecedor.update({
      where: { id: relationId },
      data: { ativo: true }
    });
  }

  /**
   * Remove vínculo com fornecedor.
   */
  async removeFornecedor(insumoId: string, relationId: string, organizationId: string) {
    await this.findById(insumoId, organizationId);
    return this.prisma.insumoFornecedor.delete({ where: { id: relationId } });
  }
}
