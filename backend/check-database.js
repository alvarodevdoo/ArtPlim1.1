const { PrismaClient } = require('@prisma/client');

async function checkDatabase() {
    const prisma = new PrismaClient();

    try {
        console.log('🔍 Checking database...');

        // Check orders
        const orders = await prisma.order.findMany({
            include: {
                customer: true,
                items: {
                    include: {
                        product: true
                    }
                }
            }
        });

        console.log(`📊 Found ${orders.length} orders in database`);

        if (orders.length > 0) {
            const firstOrder = orders[0];
            console.log('\n📋 First Order:');
            console.log('- Order Number:', firstOrder.orderNumber);
            console.log('- Customer:', firstOrder.customer?.name);
            console.log('- Items:', firstOrder.items?.length || 0);
            console.log('- Status:', firstOrder.status);
            console.log('- Total:', firstOrder.total);

            if (firstOrder.items && firstOrder.items.length > 0) {
                const firstItem = firstOrder.items[0];
                console.log('\n🛍️ First Item:');
                console.log('- Product ID:', firstItem.productId);
                console.log('- Product Name:', firstItem.product?.name || 'NULL');
                console.log('- Quantity:', firstItem.quantity);
                console.log('- Unit Price:', firstItem.unitPrice);
                console.log('- Total Price:', firstItem.totalPrice);
            }
        }

        // Check products
        const products = await prisma.product.findMany();
        console.log(`\n📦 Found ${products.length} products in database`);

        if (products.length > 0) {
            console.log('Products:');
            products.forEach(product => {
                console.log(`- ${product.name} (${product.id})`);
            });
        }

        // Check materials
        const materials = await prisma.material.findMany();
        console.log(`\n🧱 Found ${materials.length} materials in database`);

        if (materials.length > 0) {
            console.log('Materials:');
            materials.forEach(material => {
                console.log(`- ${material.name} (${material.id})`);
            });
        }

    } catch (error) {
        console.error('❌ Database error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkDatabase();