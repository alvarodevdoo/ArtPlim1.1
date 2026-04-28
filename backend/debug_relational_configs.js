const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:postgres123@127.0.0.1:5433/artplim_erp?schema=public' });

async function main() {
  await client.connect();
  const res = await client.query(`
    SELECT oic."orderItemId", p.name as product_name, pc.name as config_name, oic."selectedValue", co.label
    FROM order_item_configurations oic
    JOIN order_items oi ON oi.id = oic."orderItemId"
    JOIN products p ON p.id = oi."productId"
    JOIN product_configurations pc ON pc.id = oic."configurationId"
    LEFT JOIN configuration_options co ON co.id = oic."selectedOptionId"
    WHERE p.name ILIKE '%Vinil%'
    LIMIT 10
  `);
  
  if (res.rows.length === 0) {
    console.log("Nenhuma configuração encontrada para itens de Vinil na tabela order_item_configurations.");
  } else {
    res.rows.forEach(row => {
        console.log(`ITEM: ${row.product_name} (${row.orderItemId})`);
        console.log(`  ${row.config_name}: ${row.label || row.selectedValue}`);
    });
  }
  
  await client.end();
}

main().catch(console.error);
