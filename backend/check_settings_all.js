const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:postgres123@127.0.0.1:5433/artplim_erp?schema=public' });
client.connect()
  .then(() => client.query('SELECT "organizationId", "requireOrderDeposit", "minDepositPercent" FROM organization_settings'))
  .then(res => {
    console.table(res.rows);
    return client.end();
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
