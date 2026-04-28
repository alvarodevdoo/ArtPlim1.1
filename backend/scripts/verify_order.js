const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const orderId = 'fddb9a6f-e8e1-4e08-b707-a93e84f1025a';
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      finishedAt: true,
      approvedAt: true
    }
  });

  console.log('🔍 STATUS ATUAL DO PEDIDO:');
  console.log(JSON.stringify(order, null, 2));
  
  await prisma.$disconnect();
  await pool.end();
}

main();
