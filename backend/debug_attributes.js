const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:postgres123@127.0.0.1:5433/artplim_erp?schema=public' });

async function main() {
  await client.connect();
  const res = await client.query(`
    SELECT oi.id, p.name, oi.attributes 
    FROM order_items oi
    JOIN products p ON p.id = oi."productId"
    WHERE p.name ILIKE '%Vinil%'
    LIMIT 10
  `);
  
  res.rows.forEach(row => {
    console.log(`PRODUTO: ${row.name}`);
    console.log(`ATRIBUTOS:`, JSON.stringify(row.attributes, null, 2));
    console.log('---');
  });
  
  await client.end();
}

main().catch(console.error);
