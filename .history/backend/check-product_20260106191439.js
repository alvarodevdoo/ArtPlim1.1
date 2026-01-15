const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkProduct() {
  try {
    const products = await prisma.product.findMany({
      where: {
        name: {
          contains: 'Cartão'
        }
      },
      select: {
        id: true,
        name: true,
        pricingMode: true,
        salePrice: true,
        minPrice: true
      }
    });

    console.log('Produtos encontrados:', JSON.stringify(products, null, 2));
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkProduct();