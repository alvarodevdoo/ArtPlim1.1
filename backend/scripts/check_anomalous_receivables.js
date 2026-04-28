const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.accountReceivable.findMany({
    where: {
      organizationId: '98d5c414-b634-4530-80de-24ed89d89278',
      status: 'PENDING'
    }
  });
  console.log('Total PENDING:', result.length);
  const total = result.reduce((acc, curr) => acc + Number(curr.amount), 0);
  console.log('Total Amount:', total);
  console.log(JSON.stringify(result.map(r => ({ id: r.id, amount: r.amount, notes: r.notes })), null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
