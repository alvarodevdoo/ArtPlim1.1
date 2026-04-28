const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:postgres123@127.0.0.1:5433/artplim_erp?schema=public' });

async function main() {
  await client.connect();
  const res = await client.query(`
    SELECT oi.id, p.name, oi."paperType", oi."printColors", oi."finishing", oi."paperSize"
    FROM order_items oi
    JOIN products p ON p.id = oi."productId"
    WHERE p.name ILIKE '%Vinil%'
    ORDER BY oi.id DESC
    LIMIT 5
  `);
  
  res.rows.forEach(row => {
    console.log(`PRODUTO: ${row.name}`);
    console.log(`DADOS:`, {
        paperType: row.paperType,
        printColors: row.printColors,
        finishing: row.finishing,
        paperSize: row.paperSize
    });
    console.log('---');
  });
  
  await client.end();
}

main().catch(console.error);
