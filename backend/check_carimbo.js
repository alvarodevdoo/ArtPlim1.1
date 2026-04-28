const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:postgres123@127.0.0.1:5433/artplim_erp?schema=public' });

async function main() {
  await client.connect();
  const productId = '55f806bc-51d1-4701-8e89-a64134796b23';
  
  console.log(`\n--- FICHA TECNICA PARA ${productId} ---`);
  const ft = await client.query(`
    SELECT ft.id, ft."insumoId", m.name as "materialName", ft.quantidade
    FROM "ficha_tecnica_insumos" ft
    LEFT JOIN "materials" m ON m.id = ft."insumoId"
    WHERE ft."productId" = $1
  `, [productId]);
  console.table(ft.rows);
  
  console.log(`\n--- COMPONENTS PARA ${productId} ---`);
  const comp = await client.query(`
    SELECT pc.id, pc."materialId", m.name as "materialName", pc.quantity
    FROM "product_components" pc
    LEFT JOIN "materials" m ON m.id = pc."materialId"
    WHERE pc."productId" = $1
  `, [productId]);
  console.table(comp.rows);
  
  await client.end();
}

main().catch(console.error);
