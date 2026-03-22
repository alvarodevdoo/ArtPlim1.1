const { PrismaClient } = require('@prisma/client');
const { ProductService } = require('./src/modules/catalog/services/ProductService');
const fs = require('fs');

const prisma = new PrismaClient();
const productService = new ProductService(prisma);

async function testFind() {
  const allProds = await prisma.product.findMany({ take: 1 });
  if (allProds.length === 0) return console.log('No products');
  
  const product = await productService.findById(allProds[0].id);
  fs.writeFileSync('d:/www/NArtPlim/prod_service_debug.json', JSON.stringify(product, null, 2));
  console.log('Result saved to prod_service_debug.json');
}

testFind()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
