const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:postgres123@127.0.0.1:5433/artplim_erp?schema=public' });

async function main() {
  await client.connect();
  const res = await client.query(`
    SELECT id, name, configurations 
    FROM products 
    WHERE name ILIKE '%Vinil%'
    LIMIT 5
  `);
  
  res.rows.forEach(row => {
    console.log(`PRODUTO: ${row.name}`);
    console.log(`CONFIGURAÇÕES (VARIAÇÕES):`, JSON.stringify(row.configurations, null, 2));
    console.log('---');
  });
  
  await client.end();
}

main().catch(console.error);
