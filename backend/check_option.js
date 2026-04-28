const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:postgres123@127.0.0.1:5433/artplim_erp?schema=public' });

async function main() {
  await client.connect();
  const optionId = '269b75de-def1-4c2a-b1c8-978beaaee13d';
  
  console.log(`\n--- FICHA TECNICA PARA OPÇÃO ${optionId} ---`);
  const ft = await client.query(`
    SELECT ft.id, ft."insumoId", m.name as "materialName", ft.quantidade
    FROM "ficha_tecnica_insumos" ft
    LEFT JOIN "materials" m ON m.id = ft."insumoId"
    WHERE ft."configurationOptionId" = $1
  `, [optionId]);
  console.table(ft.rows);
  
  await client.end();
}

main().catch(console.error);
