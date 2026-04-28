const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:postgres123@127.0.0.1:5433/artplim_erp?schema=public' });
client.connect().then(() => client.query('SELECT id, "orderNumber", status, "processStatusId" FROM orders WHERE status = \'CANCELLED\'')).then(res => {
  console.table(res.rows);
  return client.end();
}).catch(console.error);
