const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:postgres123@127.0.0.1:5433/artplim_erp?schema=public' });

async function main() {
  await client.connect();
  const res = await client.query(`SELECT id, "orderNumber", status, "cancellationPaymentAction", "cancellationRefundAmount" FROM orders WHERE "orderNumber" = 'PED-0023'`);
  console.table(res.rows);
  await client.end();
}

main().catch(console.error);
