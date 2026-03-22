import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function test() {
  try {
    const order = await prisma.order.findFirst({
      where: { id: 'da2c49da-0e43-4785-ba9c-2747d0192ab9' },
      include: {
        customer: true,
        processStatus: true,
        items: { include: { product: true } },
        transactions: { include: { paymentMethod: true } }
      }
    });

    console.log("Success:", !!order);
  } catch (err) {
    console.error("Error:", err);
  }
}

test().catch(console.error).finally(() => prisma.$disconnect())
