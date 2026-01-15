import { CategoryType } from '@prisma/client';
import { NotFoundError } from '../../../shared/infrastructure/errors/AppError';

interface CreateCategoryInput {
  name: string;
  type: CategoryType;
  color?: string;
  parentId?: string;
}

export class CategoryService {
  constructor(private prisma: any) {}

  async create(data: CreateCategoryInput) {
    const category = await this.prisma.category.create({
      data: {
        name: data.name,
        type: data.type,
        color: data.color,
        parentId: data.parentId
      },
      include: {
        parent: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return category;
  }

  async list(type?: CategoryType) {
    const where: any = {
      active: true
    };

    if (type) {
      where.type = type;
    }

    return this.prisma.category.findMany({
      where,
      include: {
        parent: {
          select: {
            id: true,
            name: true
          }
        },
        children: {
          select: {
            id: true,
            name: true,
            color: true
          }
        },
        _count: {
          select: {
            transactions: true
          }
        }
      },
      orderBy: [
        { parentId: 'asc' },
        { name: 'asc' }
      ]
    });
  }

  async findById(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        parent: true,
        children: true,
        transactions: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 10
        }
      }
    });

    if (!category) {
      throw new NotFoundError('Categoria');
    }

    return category;
  }

  async update(id: string, data: Partial<CreateCategoryInput>) {
    const category = await this.prisma.category.update({
      where: { id },
      data,
      include: {
        parent: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return category;
  }

  async delete(id: string) {
    // Verificar se tem transações associadas
    const transactionCount = await this.prisma.transaction.count({
      where: { categoryId: id }
    });

    if (transactionCount > 0) {
      throw new Error('Categoria não pode ser removida pois possui transações associadas');
    }

    // Verificar se tem subcategorias
    const childrenCount = await this.prisma.category.count({
      where: { parentId: id }
    });

    if (childrenCount > 0) {
      throw new Error('Categoria não pode ser removida pois possui subcategorias');
    }

    await this.prisma.category.update({
      where: { id },
      data: { active: false }
    });

    return { message: 'Categoria removida com sucesso' };
  }

  async getCategoryStats(type?: CategoryType, startDate?: Date, endDate?: Date) {
    const where: any = {
      active: true
    };

    if (type) {
      where.type = type;
    }

    const categories = await this.prisma.category.findMany({
      where,
      include: {
        transactions: {
          where: {
            status: 'PAID',
            ...(startDate || endDate ? {
              paidAt: {
                ...(startDate && { gte: startDate }),
                ...(endDate && { lte: endDate })
              }
            } : {})
          }
        }
      }
    });

    const stats = categories.map((category: any) => {
      const totalAmount = category.transactions.reduce((sum: number, transaction: any) => {
        return sum + Number(transaction.amount);
      }, 0);

      return {
        id: category.id,
        name: category.name,
        type: category.type,
        color: category.color,
        totalTransactions: category.transactions.length,
        totalAmount,
        percentage: 0 // Será calculado depois
      };
    });

    // Calcular percentuais
    const totalAmount = stats.reduce((sum: number, stat: any) => sum + stat.totalAmount, 0);
    stats.forEach((stat: any) => {
      stat.percentage = totalAmount > 0 ? (stat.totalAmount / totalAmount) * 100 : 0;
    });

    return stats.sort((a: any, b: any) => b.totalAmount - a.totalAmount);
  }

  async createDefaultCategories() {
    const defaultCategories = [
      // Receitas
      { name: 'Vendas', type: 'INCOME', color: '#10B981' },
      { name: 'Serviços', type: 'INCOME', color: '#3B82F6' },
      { name: 'Outras Receitas', type: 'INCOME', color: '#8B5CF6' },
      
      // Despesas
      { name: 'Materiais', type: 'EXPENSE', color: '#EF4444' },
      { name: 'Salários', type: 'EXPENSE', color: '#F59E0B' },
      { name: 'Aluguel', type: 'EXPENSE', color: '#6B7280' },
      { name: 'Energia', type: 'EXPENSE', color: '#EC4899' },
      { name: 'Telefone/Internet', type: 'EXPENSE', color: '#14B8A6' },
      { name: 'Marketing', type: 'EXPENSE', color: '#F97316' },
      { name: 'Outras Despesas', type: 'EXPENSE', color: '#64748B' }
    ];

    const createdCategories = [];

    for (const categoryData of defaultCategories) {
      const existing = await this.prisma.category.findFirst({
        where: {
          name: categoryData.name,
          type: categoryData.type
        }
      });

      if (!existing) {
        const category = await this.create(categoryData as CreateCategoryInput);
        createdCategories.push(category);
      }
    }

    return createdCategories;
  }
}