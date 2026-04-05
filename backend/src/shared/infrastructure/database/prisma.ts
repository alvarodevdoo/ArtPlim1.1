import 'dotenv/config'; // DEVE ser a primeira linha
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

/**
 * SOLID: Responsabilidade de Conexão.
 * Usamos 127.0.0.1 para garantir compatibilidade com Docker no Windows.
 */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL não encontrada no ambiente.');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const globalPrisma = new PrismaClient({
  adapter,
  // Mantemos apenas erros e avisos para o console ficar limpo
  log: ['error', 'warn'],
  //log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Suas extensões de Tenant (getTenantClient) continuam aqui...
// ...

export const prisma = globalPrisma;
export default prisma;