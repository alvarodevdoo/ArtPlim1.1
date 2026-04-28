const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:postgres123@127.0.0.1:5433/artplim_erp?schema=public' });

async function main() {
  await client.connect();
  const res = await client.query(`
    SELECT oi.id, oi."productId", p.name, oi."compositionSnapshot"
    FROM "order_items" oi
    JOIN "products" p ON p.id = oi."productId"
    WHERE oi."orderId" = 'b69d4d08-5425-432a-ab2f-428e77853e4b'
  `);
  console.log('--- ITEMS ---');
  console.table(res.rows);
  
  for (const row of res.rows) {
      console.log(`\n--- FICHA TECNICA PARA ${row.name} (${row.productId}) ---`);
      const ft = await client.query(`
        SELECT ft.id, ft."insumoId", m.name as "materialName", ft.quantidade
        FROM "ficha_tecnica_insumos" ft
        LEFT JOIN "materials" m ON m.id = ft."insumoId"
        WHERE ft."productId" = $1
      `, [row.productId]);
      console.table(ft.rows);
      
      console.log(`\n--- COMPONENTS PARA ${row.name} ---`);
      const comp = await client.query(`
        SELECT pc.id, pc."materialId", m.name as "materialName", pc.quantity
        FROM "product_components" pc
        LEFT JOIN "materials" m ON m.id = pc."materialId"
        WHERE pc."productId" = $1
      `, [row.productId]);
      console.table(comp.rows);
  }
  
  await client.end();
}

main().catch(console.error);
