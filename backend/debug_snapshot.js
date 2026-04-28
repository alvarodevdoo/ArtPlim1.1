const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:postgres123@127.0.0.1:5433/artplim_erp?schema=public' });

async function main() {
  await client.connect();
  const res = await client.query(`
    SELECT oi.id, p.name, oi."compositionSnapshot"
    FROM order_items oi
    JOIN products p ON p.id = oi."productId"
    WHERE p.name ILIKE '%Vinil%'
    AND oi."compositionSnapshot" IS NOT NULL
    LIMIT 5
  `);
  
  if (res.rows.length === 0) {
    console.log("Nenhum item de Vinil encontrado com compositionSnapshot preenchido.");
  } else {
    res.rows.forEach(row => {
        console.log(`PRODUTO: ${row.name}`);
        console.log(`COMPOSIÇÃO:`, JSON.stringify(row.compositionSnapshot, null, 2));
    });
  }
  
  await client.end();
}

main().catch(console.error);
