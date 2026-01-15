// Setup global para testes
import { PrismaClient } from '@prisma/client';

// Mock do Prisma para testes
export const mockPrisma = {
  product: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
  },
  material: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
  },
  productComponent: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  productConfiguration: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  configurationOption: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  productionWaste: {
    findMany: jest.fn(),
    create: jest.fn(),
    groupBy: jest.fn(),
  },
};

// Reset mocks antes de cada teste
beforeEach(() => {
  jest.clearAllMocks();
});