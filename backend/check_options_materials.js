const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:postgres123@127.0.0.1:5433/artplim_erp?schema=public' });

async function main() {
  await client.connect();
  const res = await client.query('SELECT id, name, "materialId" FROM configuration_options WHERE "materialId" IS NOT NULL');
  console.table(res.rows);
  await client.end();
}

main().catch(console.error);
