const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:postgres123@127.0.0.1:5433/artplim_erp?schema=public' });

async function main() {
  await client.connect();
  const res = await client.query(`SELECT id, "organizationId" FROM profiles WHERE name ILIKE '%Portuguesa%' LIMIT 1`);
  if (res.rows.length > 0) {
    const profile = res.rows[0];
    
    await client.query('BEGIN');
    
    // Update balance
    await client.query(`UPDATE profiles SET balance = balance + 38.40 WHERE id = $1`, [profile.id]);
    
    // Insert movement
    await client.query(`
      INSERT INTO profile_balance_movements (id, "organizationId", "profileId", amount, type, description, "createdAt")
      VALUES (gen_random_uuid(), $1, $2, 38.40, 'CREDIT', 'Crédito por cancelamento do pedido #PED-0023 (Correção Manual)', NOW())
    `, [profile.organizationId, profile.id]);
    
    await client.query('COMMIT');
    console.log('Credit 38.40 applied successfully to Banca da Portuguesa');
  }
  await client.end();
}

main().catch(async (e) => {
  await client.query('ROLLBACK');
  console.error(e);
  await client.end();
});
