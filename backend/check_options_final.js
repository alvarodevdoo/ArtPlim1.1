const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:postgres123@127.0.0.1:5433/artplim_erp?schema=public' });

async function main() {
  await client.connect();
  const res = await client.query('SELECT id, label, "materialId" FROM configuration_options WHERE "materialId" IS NOT NULL');
  console.log(`Encontradas ${res.rows.length} opções com materialId`);
  console.table(res.rows);
  await client.end();
}

main().catch(console.error);
