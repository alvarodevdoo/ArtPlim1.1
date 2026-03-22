const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function checkProduct() {
  const products = await prisma.product.findMany({
    take: 1
  });

  if (products.length > 0) {
    fs.writeFileSync('d:/www/NArtPlim/prod_debug.json', JSON.stringify(products[0], null, 2));
    console.log('Saved to prod_debug.json');
  } else {
    console.log('Nenhum produto encontrado.');
  }
}

checkProduct()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
