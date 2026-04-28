const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:postgres123@127.0.0.1:5433/artplim_erp?schema=public' });

async function main() {
  await client.connect();
  const orderId = 'd53d6077-afa1-4117-9b3a-9cfedbcdaccc';
  
  const orderRes = await client.query('SELECT id, "discountStatus", total FROM orders WHERE id = $1', [orderId]);
  const order = orderRes.rows[0];
  
  if (!order) {
    console.log('Pedido não encontrado');
    await client.end();
    return;
  }
  
  console.log('--- Pedido ---');
  console.log('ID:', order.id);
  console.log('Status do Desconto (Global):', order.discountStatus);
  console.log('Total:', order.total);
  
  const itemsRes = await client.query('SELECT "productId", "discountStatus", "discountItem", "discountGlobal", "unitPrice", quantity FROM order_items WHERE "orderId" = $1', [orderId]);
  
  console.log('\n--- Itens ---');
  itemsRes.rows.forEach((item, i) => {
    console.log(`Item ${i + 1}:`);
    console.log('  Produto:', item.productId);
    console.log('  Status do Desconto:', item.discountStatus);
    console.log('  Desconto Item:', item.discountItem);
    console.log('  Desconto Global:', item.discountGlobal);
    console.log('  Preço Unitário:', item.unitPrice);
    console.log('  Quantidade:', item.quantity);
  });
  
  await client.end();
}

main().catch(console.error);
